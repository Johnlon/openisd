#!/usr/bin/env python3
"""
scripts/lib/metrics.py — reads test logs, watchdog logs, post-land logs,
delegation logs, task files and git log to generate metrics.json and index.html.

Rule (processes.md rule 8, John 16 Oct 2026):
  "Metrics come from these logs plus git, read by one script. There is no second event store."
"""

import sys
import os
import re
import json
import glob
import subprocess
from datetime import datetime, timezone, timedelta
from pathlib import Path

def parse_iso(ts_str):
    if not ts_str:
        return None
    ts_str = ts_str.strip()
    # Normalize Z to +00:00
    if ts_str.endswith('Z'):
        ts_str = ts_str[:-1] + '+00:00'
    try:
        return datetime.fromisoformat(ts_str)
    except Exception:
        # Try without microseconds or with custom regex
        m = re.match(r'^(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})(?:\.(\d+))?([+-]\d{2}:?\d{2}|Z)?$', ts_str)
        if m:
            base = m.group(1).replace(' ', 'T')
            frac = (m.group(2) or '0')[:6].ljust(6, '0')
            tz = m.group(3) or '+00:00'
            if tz == 'Z': tz = '+00:00'
            return datetime.fromisoformat(f"{base}.{frac}{tz}")
    return None

def budget_limits(root):
    """The pool sizes, read from scripts/budget.conf (the one place they are set)."""
    conf = root / "scripts" / "budget.conf"
    if not conf.exists():
        return {}
    return {m.group(1): int(m.group(2)) for m in re.finditer(r'^(POOL_\w+_MB)=(\d+)', conf.read_text(), re.M)}


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Generate OpenISD test and SDLC metrics.")
    parser.add_argument("--repo-root", default=os.getcwd(), help="Path to repo root")
    parser.add_argument("--fixture-dir", default=None, help="Use fixture directory for inputs")
    parser.add_argument("--output-dir", default=None, help="Output directory (default: build/metrics)")
    args = parser.parse_args()

    root = Path(args.repo_root).resolve()
    fixture = Path(args.fixture_dir).resolve() if args.fixture_dir else None

    # Input paths
    if fixture:
        test_logs_dirs = [fixture / "test-logs"]
        watchdog_logs = [fixture / "watchdog.log", fixture / "test-logs" / "watchdog.log"]
        housekeeping_logs = [fixture / "housekeeping.log", fixture / "test-logs" / "housekeeping.log"]
        post_land_logs = [fixture / "post-land.log"]
        delegation_logs = [fixture / "DELEGATION_LOG.md"]
        zoo_log_dirs = [fixture / "zoo-logs"]
        tasks_dir = fixture / "tasks"
        fixes_dir = fixture / "tasks" / "fixes"
        fixture_git_log = fixture / "git.log"
    else:
        test_logs_dirs = [
            root / "build" / "test-logs",
            Path("/home/john/work/winisd/openisd/build/test-logs")
        ]
        watchdog_logs = [
            root / "build" / "test-logs" / "watchdog.log",
            Path("/home/john/work/winisd/openisd/build/test-logs/watchdog.log")
        ]
        housekeeping_logs = [
            root / "build" / "test-logs" / "housekeeping.log",
            root / "housekeeping.log",
            Path("/home/john/work/winisd/openisd/build/test-logs/housekeeping.log")
        ]
        post_land_logs = [
            Path("/home/john/work/winisd/.postland/post-land.log"),
            root / "build" / "test-logs" / "post-land.log"
        ]
        delegation_logs = [
            Path("/home/john/work/winisd/zoo/DELEGATION_LOG.md"),
            root / "zoo" / "DELEGATION_LOG.md"
        ]
        zoo_log_dirs = [
            Path("/home/john/work/winisd/zoo/logs"),
            root / "zoo" / "logs"
        ]
        tasks_dir = root / "tasks"
        fixes_dir = root / "tasks" / "fixes"
        fixture_git_log = None

    out_dir = Path(args.output_dir) if args.output_dir else (root / "build" / "metrics")
    out_dir.mkdir(parents=True, exist_ok=True)

    now = datetime.now(timezone.utc)
    cutoff_7d = now - timedelta(days=7)
    cutoff_30d = now - timedelta(days=30)

    # 1. Read Git commits
    git_commits = []
    if fixture_git_log and fixture_git_log.exists():
        with open(fixture_git_log, 'r', encoding='utf-8', errors='replace') as f:
            for line in f:
                parts = line.strip().split('|')
                if len(parts) >= 4:
                    sha, epoch_str, iso_str, subj = parts[0], parts[1], parts[2], parts[3]
                    dt = parse_iso(iso_str) or datetime.fromtimestamp(int(epoch_str), tz=timezone.utc)
                    git_commits.append({"sha": sha, "dt": dt, "subject": subj})
    else:
        try:
            res = subprocess.run(
                ["git", "log", "--format=%H|%ct|%cI|%s", "origin/main", "--since=35 days ago"],
                cwd=str(root), capture_output=True, text=True, check=False
            )
            if res.returncode == 0:
                for line in res.stdout.strip().splitlines():
                    parts = line.split('|')
                    if len(parts) >= 4:
                        sha, epoch_str, iso_str, subj = parts[0], parts[1], parts[2], parts[3]
                        dt = parse_iso(iso_str) or datetime.fromtimestamp(int(epoch_str), tz=timezone.utc)
                        git_commits.append({"sha": sha, "dt": dt, "subject": subj})
        except Exception:
            pass

    # 2. Parse build/test-logs/*.log
    log_files = []
    for d in test_logs_dirs:
        if d.exists():
            log_files.extend(glob.glob(str(d / "*.log")))
    log_files = sorted(list(set(log_files)))

    # Metrics containers
    landings = []       # {task_id, start_ts, end_ts, duration_s, gates: {gate_name: dur_s}, approximate}
    spec_durations = {} # spec_name -> list of {dt, duration_ms, status}
    queue_waits = []    # {type: 'admission'|'suite_lock'|'heavy', wait_s, dt, approximate}
    memory_peaks = []   # {label, peak_mb, dt, limit_mb}
    kills_events = []   # {mechanism, dt, detail}

    # Line regexes
    re_ts_line = re.compile(r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s+(\S+)\s+(.*)$')
    re_start = re.compile(r'^START\s+(\S+)$')
    re_end = re.compile(r'^END\s+(\S+)\s+status=(\d+)\s+duration_s=(\d+)(?:\s+clock_step_s=-?\d+)?$')
    re_spec_end = re.compile(r'SPEC END\s+(\S+)\s+status=(\S+)\s+duration_ms=([0-9.]+)')
    re_test_end = re.compile(r'TEST END\s+(\S+)\s+status=(\S+)\s+duration_ms=([0-9.]+)')
    re_pw_test = re.compile(r'^\s*(?:✓|✘)\s+\d+\s+([^:]+\.browser\.spec\.ts):\d+:\d+\s+›.*\((\d+(?:\.\d+)?)(s|ms)\)')
    re_vt_test = re.compile(r'^\s*(?:✓|FAIL)\s+.*?([^/\s]+\.test\.ts)\s+.*?\s+(\d+)ms')
    re_admit_wait = re.compile(r'waiting for slot:\s+\d+\s+ahead,\s+holder\s+.*,\s+(\d+)\s+s')
    re_suite_wait = re.compile(r'suite-lock: waiting:')
    re_budget_wait = re.compile(r'budget: waiting for the (\S+) pool:\s+(\d+)\s+MB')
    re_quiet_stall = re.compile(r'quiet-test: STALLED')
    re_peak = re.compile(r'peak\s+(\S+)\s+([0-9.]+)\s+GB\s+exit\s+(\d+)\s+seconds\s+(\d+)')
    re_slice_high = re.compile(r'suite throttled: sizing bug \(heavy\.slice went over MemoryHigh')

    for lf in log_files:
        p = Path(lf)
        if p.name in ("watchdog.log", "housekeeping.log", "post-land.log"):
            continue
        try:
            mtime = datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc)
            # Try to get timestamp from filename: YYYYMMDD-HHMMSS-PID.log
            m_fn = re.match(r'^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})', p.name)
            file_ts = mtime
            if m_fn:
                try:
                    file_ts = datetime(
                        int(m_fn.group(1)), int(m_fn.group(2)), int(m_fn.group(3)),
                        int(m_fn.group(4)), int(m_fn.group(5)), int(m_fn.group(6)),
                        tzinfo=timezone.utc
                    )
                except Exception:
                    pass

            with open(p, 'r', encoding='utf-8', errors='replace') as f:
                current_landing = None
                has_ts_lines = False

                for line in f:
                    line_str = line.strip()
                    m_ts = re_ts_line.match(line_str)
                    dt = file_ts
                    content = line_str

                    if m_ts:
                        has_ts_lines = True
                        dt = parse_iso(m_ts.group(1)) or file_ts
                        content = m_ts.group(3)

                    # START / END
                    m_s = re_start.match(content)
                    if m_s:
                        name = m_s.group(1)
                        if name.startswith("land-") or name == "land":
                            current_landing = {"task_id": name, "start_ts": dt, "gates": {}, "approximate": not has_ts_lines}
                    m_e = re_end.match(content)
                    if m_e:
                        name = m_e.group(1)
                        status = int(m_e.group(2))
                        dur = int(m_e.group(3))
                        if current_landing and (name.startswith("land-") or name == "land"):
                            current_landing["end_ts"] = dt
                            current_landing["duration_s"] = dur
                            current_landing["status"] = status
                            landings.append(current_landing)
                            current_landing = None
                        elif current_landing:
                            current_landing["gates"][name] = dur

                    # Spec durations
                    m_spec = re_spec_end.search(content)
                    if m_spec:
                        s_name = m_spec.group(1)
                        s_st = m_spec.group(2)
                        s_dur = float(m_spec.group(3))
                        spec_durations.setdefault(s_name, []).append({"dt": dt, "duration_ms": s_dur, "status": s_st})

                    # Fallback Playwright test line
                    m_pw = re_pw_test.search(content)
                    if m_pw:
                        s_file = m_pw.group(1)
                        dur_val = float(m_pw.group(2))
                        if m_pw.group(3) == 's':
                            dur_val *= 1000
                        spec_durations.setdefault(s_file, []).append({"dt": dt, "duration_ms": dur_val, "status": "passed"})

                    # Fallback Vitest test line
                    m_vt = re_vt_test.search(content)
                    if m_vt:
                        s_file = m_vt.group(1)
                        dur_val = float(m_vt.group(2))
                        spec_durations.setdefault(s_file, []).append({"dt": dt, "duration_ms": dur_val, "status": "passed"})

                    # Queue waits
                    m_ad = re_admit_wait.search(content)
                    if m_ad:
                        queue_waits.append({"type": "admission", "wait_s": int(m_ad.group(1)), "dt": dt, "approximate": not has_ts_lines})
                    if re_suite_wait.search(content):
                        queue_waits.append({"type": "suite_lock", "wait_s": 5, "dt": dt, "approximate": True})
                    m_bg = re_budget_wait.search(content)
                    if m_bg:
                        queue_waits.append({"type": f"budget_{m_bg.group(1)}", "wait_s": 10, "dt": dt, "approximate": True})

                    # Kills & limits
                    if re_quiet_stall.search(content):
                        kills_events.append({"mechanism": "quiet_test_idle_watchdog", "dt": dt, "detail": "quiet-test stalled (idle timeout)"})
                    m_pk = re_peak.search(content)
                    if m_pk:
                        peak_gb = float(m_pk.group(2))
                        memory_peaks.append({"label": m_pk.group(1), "peak_mb": int(peak_gb * 1024), "dt": dt, "limit_mb": 1400})
                    if re_slice_high.search(content):
                        kills_events.append({"mechanism": "heavy_slice_memory_high", "dt": dt, "detail": "heavy.slice went over MemoryHigh"})
        except Exception:
            continue

    # 3. Parse watchdog.log
    for wlog in watchdog_logs:
        if wlog.exists():
            try:
                with open(wlog, 'r', encoding='utf-8', errors='replace') as f:
                    for line in f:
                        line_str = line.strip()
                        m_ts = re_ts_line.match(line_str)
                        dt = None
                        content = line_str
                        if m_ts:
                            dt = parse_iso(m_ts.group(1))
                            content = m_ts.group(3)
                        else:
                            # watchdog log: 2026-10-16T21:14:30Z watchdog: ...
                            m_wd = re.match(r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\s+watchdog:\s+(.*)$', line_str)
                            if m_wd:
                                dt = parse_iso(m_wd.group(1))
                                content = m_wd.group(2)

                        if "hung:" in content and "killing group" in content:
                            kills_events.append({"mechanism": "watchdog_hung_post_land", "dt": dt or now, "detail": content})
                        if "gate refused" in content:
                            kills_events.append({"mechanism": "gate_refusal_watchdog", "dt": dt or now, "detail": content})
            except Exception:
                pass

    # 4. Parse housekeeping.log
    for hlog in housekeeping_logs:
        if hlog.exists():
            try:
                with open(hlog, 'r', encoding='utf-8', errors='replace') as f:
                    for line in f:
                        line_str = line.strip()
                        m_hk = re.match(r'^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)\s+housekeeping:\s+(.*)$', line_str)
                        dt = now
                        content = line_str
                        if m_hk:
                            dt = parse_iso(m_hk.group(1)) or now
                            content = m_hk.group(2)
                        if "stopped browser run" in content:
                            kills_events.append({"mechanism": "housekeeping_stopped_browser", "dt": dt, "detail": content})
                        if "freed slot" in content:
                            kills_events.append({"mechanism": "housekeeping_freed_slot", "dt": dt, "detail": content})
                        if "removed post-land copy" in content:
                            kills_events.append({"mechanism": "housekeeping_removed_copy", "dt": dt, "detail": content})
            except Exception:
                pass

    # 5. Parse post-land.log
    post_land_runs = [] # {sha, start_dt, end_dt, result: 'green'|'red'|'superseded'|'timeout', dur_s, approximate}
    for plog in post_land_logs:
        if plog.exists():
            try:
                mtime = datetime.fromtimestamp(plog.stat().st_mtime, tz=timezone.utc)
                current_run = None
                with open(plog, 'r', encoding='utf-8', errors='replace') as f:
                    for line in f:
                        line_str = line.strip()
                        m_ts = re_ts_line.match(line_str)
                        dt = None
                        content = line_str
                        if m_ts:
                            dt = parse_iso(m_ts.group(1))
                            content = m_ts.group(3)
                        
                        m_run = re.search(r'post-land: running the full suite on\s+([0-9a-fA-F]+)', content)
                        if m_run:
                            sha = m_run.group(1)
                            current_run = {"sha": sha, "start_dt": dt or mtime, "approximate": dt is None}
                        if current_run:
                            m_green = re.search(r'post-land: green at\s+([0-9a-fA-F]+)', content)
                            m_red = re.search(r'post-land: RED at\s+([0-9a-fA-F]+)', content)
                            m_super = re.search(r'post-land: superseded by.*?(?:killed)?', content)
                            m_time = re.search(r'post-land: TIMED OUT after\s+(\d+)s\s+at\s+([0-9a-fA-F]+)', content)
                            if m_green:
                                current_run["result"] = "green"
                                current_run["end_dt"] = dt or mtime
                                current_run["dur_s"] = int((current_run["end_dt"] - current_run["start_dt"]).total_seconds()) if dt else 0
                                post_land_runs.append(current_run)
                                current_run = None
                            elif m_red:
                                current_run["result"] = "red"
                                current_run["end_dt"] = dt or mtime
                                current_run["dur_s"] = int((current_run["end_dt"] - current_run["start_dt"]).total_seconds()) if dt else 0
                                post_land_runs.append(current_run)
                                current_run = None
                            elif m_time:
                                current_run["result"] = "timeout"
                                current_run["end_dt"] = dt or mtime
                                current_run["dur_s"] = int(m_time.group(1))
                                kills_events.append({"mechanism": "post_land_timeout", "dt": dt or mtime, "detail": content})
                                post_land_runs.append(current_run)
                                current_run = None
                            elif m_super:
                                current_run["result"] = "superseded"
                                current_run["end_dt"] = dt or mtime
                                current_run["dur_s"] = int((current_run["end_dt"] - current_run["start_dt"]).total_seconds()) if dt else 0
                                post_land_runs.append(current_run)
                                current_run = None
            except Exception:
                pass

    # The logs carry no land START/END before T254, so commits on main stand in as landings: one commit
    # per landing, at its commit time, marked approximate (git, not the land log).
    logged = {l["task_id"] for l in landings}
    for c in git_commits:
        if c["sha"][:10] not in logged:
            landings.append({"task_id": c["subject"].split(":")[0][:40], "start_ts": c["dt"], "end_ts": c["dt"],
                             "duration_s": 0, "gates": {}, "approximate": True, "source": "git", "sha": c["sha"][:10]})

    # Match post-land runs against git commit push times for Push-to-Result calculation
    push_to_postland = [] # {sha, push_dt, result, duration_s, approximate}
    commit_by_sha = {c["sha"][:10]: c for c in git_commits}
    commit_by_sha.update({c["sha"]: c for c in git_commits})

    for plr in post_land_runs:
        sha = plr["sha"]
        matching_commit = commit_by_sha.get(sha[:10]) or commit_by_sha.get(sha)
        if matching_commit:
            push_dt = matching_commit["dt"]
            end_dt = plr.get("end_dt") or plr.get("start_dt")
            diff_s = int((end_dt - push_dt).total_seconds())
            if plr.get("approximate") or diff_s < 0:
                # No timestamp in the log line: the end is the log file's mtime, not the run's end.
                diff_s = plr.get("dur_s", 0)
            push_to_postland.append({
                "sha": sha[:10],
                "push_dt": push_dt.isoformat(),
                "result": plr.get("result", "unknown"),
                "duration_s": max(0, diff_s),
                "approximate": plr.get("approximate", False)
            })
        else:
            push_to_postland.append({
                "sha": sha[:10],
                # A run with no timestamp and no commit in git history has no known time: no window holds it.
                "push_dt": None if plr.get("approximate") else plr["start_dt"].isoformat(),
                "result": plr.get("result", "unknown"),
                "duration_s": plr.get("dur_s", 0),
                "approximate": True
            })

    # 6. Parse tasks/fixes/*.yml for Reds by cause
    reds_by_cause = {"assertion": 0, "timeout": 0, "killed": 0, "throttled": 0, "records": []}
    if fixes_dir.exists():
        for fy in sorted(glob.glob(str(fixes_dir / "F*.yml"))):
            p = Path(fy)
            try:
                text = p.read_text(encoding='utf-8', errors='replace')
                mtime = datetime.fromtimestamp(p.stat().st_mtime, tz=timezone.utc)
                if not fixture_git_log:
                    # mtime is the checkout time; the commit that opened the F is when it went red.
                    g = subprocess.run(["git", "log", "--diff-filter=A", "--format=%cI", "--", str(p)],
                                       cwd=str(root), capture_output=True, text=True, check=False)
                    when = parse_iso(g.stdout.strip().splitlines()[-1]) if g.returncode == 0 and g.stdout.strip() else None
                    mtime = when or mtime
                # Parse cause
                cause = "assertion"
                text_lower = text.lower()
                if "timed out" in text_lower or "timebox" in text_lower or "timeouterror" in text_lower or "deadline" in text_lower:
                    cause = "timeout"
                elif "killed" in text_lower or "oom" in text_lower or "sigkill" in text_lower or "superseded" in text_lower:
                    cause = "killed"
                elif "throttled" in text_lower or "memoryhigh" in text_lower:
                    cause = "throttled"
                elif "fail" in text_lower or "error" in text_lower or "assertion" in text_lower:
                    cause = "assertion"
                
                # Check status and id
                m_id = re.search(r'^id:\s*(\S+)', text, re.M)
                fid = m_id.group(1) if m_id else p.stem
                m_sha = re.search(r'^sha:\s*(\S+)', text, re.M)
                fsha = m_sha.group(1) if m_sha else ""

                reds_by_cause[cause] += 1
                reds_by_cause["records"].append({
                    "id": fid,
                    "sha": fsha[:10],
                    "cause": cause,
                    "dt": mtime.isoformat()
                })
            except Exception:
                pass

    # 7. Parse DELEGATION_LOG.md
    delegated_jobs = [] # {job_name, dt, duration_min, outcome, is_retry}
    for dlog in delegation_logs:
        if dlog.exists():
            try:
                with open(dlog, 'r', encoding='utf-8', errors='replace') as f:
                    for line in f:
                        parts = [p.strip() for p in line.split('|')]
                        if len(parts) >= 6:
                            # 2026-10-10 17:01:07 | tools-probe | agy | gemini-3.8-flash-high | 1 min | done
                            ts_str = parts[0]
                            dt = parse_iso(ts_str.replace(' ', 'T') + 'Z')
                            job = parts[1]
                            tool = parts[2]
                            model = parts[3]
                            dur_str = parts[4]
                            outcome = parts[5]

                            dur_m = re.search(r'(\d+)\s*min', dur_str)
                            dur_min = int(dur_m.group(1)) if dur_m else 0
                            is_retry = bool(re.search(r'-r\d+', job))

                            delegated_jobs.append({
                                "job": job,
                                "tool": tool,
                                "model": model,
                                "dt": dt.isoformat() if dt else ts_str,
                                "duration_min": dur_min,
                                "outcome": outcome,
                                "is_retry": is_retry
                            })
            except Exception:
                pass

    # 8. Compute slowest 20 specs and trends
    specs_summary = []
    for s_name, runs in spec_durations.items():
        durations = [r["duration_ms"] for r in runs]
        avg_ms = sum(durations) / len(durations) if durations else 0
        max_ms = max(durations) if durations else 0
        specs_summary.append({
            "spec": s_name,
            "count": len(runs),
            "avg_ms": round(avg_ms, 1),
            "max_ms": round(max_ms, 1),
            "recent_durations": [r["duration_ms"] for r in runs[-10:]]
        })
    specs_summary.sort(key=lambda x: x["max_ms"], reverse=True)
    slowest_20_specs = specs_summary[:20]

    # Partition metrics for 7-day and 30-day windows
    def filter_by_window(items, dt_key, cutoff):
        res = []
        for it in items:
            t = it.get(dt_key)
            if isinstance(t, str):
                t = parse_iso(t)
            if t and t >= cutoff:
                res.append(it)
        return res

    # Build final metrics dict
    metrics_data = {
        "generated_at": now.isoformat(),
        "windows": {
            "7d": {
                "landings_count": len(filter_by_window(landings, "start_ts", cutoff_7d)),
                "landings": filter_by_window(landings, "start_ts", cutoff_7d),
                "push_to_postland": filter_by_window(push_to_postland, "push_dt", cutoff_7d),
                "reds_by_cause": {
                    "assertion": len([r for r in filter_by_window(reds_by_cause["records"], "dt", cutoff_7d) if r["cause"] == "assertion"]),
                    "timeout": len([r for r in filter_by_window(reds_by_cause["records"], "dt", cutoff_7d) if r["cause"] == "timeout"]),
                    "killed": len([r for r in filter_by_window(reds_by_cause["records"], "dt", cutoff_7d) if r["cause"] == "killed"]),
                    "throttled": len([r for r in filter_by_window(reds_by_cause["records"], "dt", cutoff_7d) if r["cause"] == "throttled"])
                },
                "kills_and_limits": filter_by_window(kills_events, "dt", cutoff_7d),
                "queue_waits": filter_by_window(queue_waits, "dt", cutoff_7d),
                "memory_peaks": filter_by_window(memory_peaks, "dt", cutoff_7d),
                "delegated_jobs": filter_by_window(delegated_jobs, "dt", cutoff_7d)
            },
            "30d": {
                "landings_count": len(filter_by_window(landings, "start_ts", cutoff_30d)),
                "landings": filter_by_window(landings, "start_ts", cutoff_30d),
                "push_to_postland": filter_by_window(push_to_postland, "push_dt", cutoff_30d),
                "reds_by_cause": {
                    "assertion": len([r for r in filter_by_window(reds_by_cause["records"], "dt", cutoff_30d) if r["cause"] == "assertion"]),
                    "timeout": len([r for r in filter_by_window(reds_by_cause["records"], "dt", cutoff_30d) if r["cause"] == "timeout"]),
                    "killed": len([r for r in filter_by_window(reds_by_cause["records"], "dt", cutoff_30d) if r["cause"] == "killed"]),
                    "throttled": len([r for r in filter_by_window(reds_by_cause["records"], "dt", cutoff_30d) if r["cause"] == "throttled"])
                },
                "kills_and_limits": filter_by_window(kills_events, "dt", cutoff_30d),
                "queue_waits": filter_by_window(queue_waits, "dt", cutoff_30d),
                "memory_peaks": filter_by_window(memory_peaks, "dt", cutoff_30d),
                "delegated_jobs": filter_by_window(delegated_jobs, "dt", cutoff_30d)
            }
        },
        "slowest_20_specs": slowest_20_specs,
        "all_reds_records": reds_by_cause["records"],
        "budget_limits": budget_limits(root)
    }

    # Write metrics.json
    json_path = out_dir / "metrics.json"
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(metrics_data, f, indent=2, default=str)
    print(f"metrics: wrote {json_path}")

    # Generate static index.html
    html_content = generate_html(metrics_data)
    html_path = out_dir / "index.html"
    with open(html_path, 'w', encoding='utf-8') as f:
        f.write(html_content)
    print(f"metrics: wrote {html_path}")

def generate_html(m):
    _w7 = m["windows"]["7d"]
    _gates = {}
    for _l in _w7["landings"]:
        for _g, _d in _l.get("gates", {}).items():
            _gates.setdefault(_g, []).append(_d)
    gate_summary = ", ".join(f"{g} {round(sum(v) / len(v))} s" for g, v in sorted(_gates.items())) or "none logged yet"
    _pl = _w7["push_to_postland"]
    _n = lambda r: len([x for x in _pl if x["result"] == r])
    pl_counts = f"{_n('green')} / {_n('red')} / {_n('superseded')} / {_n('timeout')}"
    _timed = [x["duration_s"] for x in _pl if not x["approximate"]]
    pl_avg = f"{round(sum(_timed) / len(_timed) / 60, 1)} min ({len(_timed)} runs)" if _timed else "no timestamped runs yet"
    w7 = m["windows"]["7d"]
    w30 = m["windows"]["30d"]
    reds7 = w7["reds_by_cause"]
    reds30 = w30["reds_by_cause"]
    slowest = m["slowest_20_specs"]

    # Simple SVG horizontal bar chart generator
    def render_bar_chart(data_items, max_val=None, height=220, unit=""):
        if not data_items:
            return '<p class="muted">No data points recorded</p>'
        if not max_val:
            max_val = max([val for _, val in data_items] + [1])
        svg_bars = []
        y = 25
        for label, val in data_items:
            w = int((val / max_val) * 260) if max_val > 0 else 0
            svg_bars.append(f'''
            <text x="10" y="{y+14}" class="chart-label">{label}</text>
            <rect x="130" y="{y}" width="{max(w, 2)}" height="18" rx="3" class="bar-fill" />
            <text x="{135 + max(w, 2)}" y="{y+14}" class="chart-val">{val}{unit}</text>
            ''')
            y += 28
        svg_h = max(height, y + 10)
        return f'''<svg viewBox="0 0 450 {svg_h}" class="chart-svg">{"".join(svg_bars)}</svg>'''

    reds_bars_7 = [("Assertion", reds7["assertion"]), ("Timeout", reds7["timeout"]), ("Killed", reds7["killed"]), ("Throttled", reds7["throttled"])]
    reds_bars_30 = [("Assertion", reds30["assertion"]), ("Timeout", reds30["timeout"]), ("Killed", reds30["killed"]), ("Throttled", reds30["throttled"])]

    # Slowest specs table rows
    slow_rows = []
    for i, s in enumerate(slowest, 1):
        slow_rows.append(f'''<tr>
            <td>{i}</td>
            <td class="code">{s["spec"]}</td>
            <td>{s["max_ms"]} ms</td>
            <td>{s["avg_ms"]} ms</td>
            <td>{s["count"]}</td>
        </tr>''')

    # Delegated jobs summary
    del_7 = w7["delegated_jobs"]
    del_7_done = len([j for j in del_7 if j["outcome"] == "done"])
    del_7_failed = len([j for j in del_7 if "fail" in j["outcome"]])
    del_7_killed = len([j for j in del_7 if "kill" in j["outcome"]])
    del_7_retries = len([j for j in del_7 if j["is_retry"]])
    del_7_dur = [j["duration_min"] for j in del_7]
    del_7_avg = round(sum(del_7_dur) / len(del_7_dur), 1) if del_7_dur else 0

    # Queue waits summary
    qw_7 = w7["queue_waits"]
    admit_waits = [q["wait_s"] for q in qw_7 if q["type"] == "admission"]
    suite_waits = [q["wait_s"] for q in qw_7 if q["type"] == "suite_lock"]
    heavy_waits = [q["wait_s"] for q in qw_7 if "budget" in q["type"]]

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenISD Test & System Metrics</title>
  <style>
    :root {{
      --bg: #0e1117;
      --card-bg: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --text-bright: #f0f6fc;
      --accent: #58a6ff;
      --green: #3fb950;
      --red: #f85149;
      --amber: #d29922;
      --purple: #bc8cff;
      --muted: #8b949e;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 12px;
    }}
    header {{
      padding: 16px 8px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 20px;
    }}
    h1 {{ font-size: 1.4rem; color: var(--text-bright); font-weight: 600; margin-bottom: 4px; }}
    .gen-time {{ font-size: 0.8rem; color: var(--muted); }}
    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }}
    .card {{
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
    }}
    .card h2 {{
      font-size: 1.05rem;
      color: var(--text-bright);
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }}
    .tag {{
      font-size: 0.7rem;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--border);
      color: var(--text);
    }}
    .tag.approx {{ background: rgba(210, 153, 34, 0.2); color: var(--amber); border: 1px solid var(--amber); }}
    .metric-val {{ font-size: 1.8rem; font-weight: 700; color: var(--text-bright); margin: 8px 0; }}
    .metric-sub {{ font-size: 0.85rem; color: var(--muted); }}
    .chart-svg {{ width: 100%; height: auto; }}
    .chart-label {{ font-size: 11px; fill: var(--text); font-family: monospace; }}
    .chart-val {{ font-size: 11px; fill: var(--text-bright); font-weight: 600; font-family: monospace; }}
    .bar-fill {{ fill: var(--accent); }}
    table {{ width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-top: 8px; }}
    th, td {{ padding: 8px; text-align: left; border-bottom: 1px solid var(--border); }}
    th {{ color: var(--muted); font-weight: 500; font-size: 0.75rem; text-transform: uppercase; }}
    .code {{ font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace; word-break: break-all; }}
    .stat-row {{ display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid rgba(48,54,61,0.5); font-size: 0.85rem; }}
    .stat-label {{ color: var(--muted); }}
    .stat-val {{ font-weight: 600; color: var(--text-bright); }}
    @media (max-width: 600px) {{
      body {{ padding: 8px; }}
      .grid {{ grid-template-columns: 1fr; }}
      h1 {{ font-size: 1.2rem; }}
      .card {{ padding: 12px; }}
    }}
  </style>
</head>
<body>
  <header>
    <h1>OpenISD Test & System Metrics</h1>
    <div class="gen-time">Generated {m["generated_at"]} UTC &bull; Dual-window: 7d and 30d &bull; processes.md rule 8</div>
  </header>

  <div class="grid">
    <!-- Card 1: Landing Time -->
    <div class="card">
      <h2>1. Landing Time (land.sh start to push) <span class="tag">7d / 30d</span></h2>
      <div class="stat-row">
        <span class="stat-label">Total Landings (7d / 30d):</span>
        <span class="stat-val">{w7["landings_count"]} / {w30["landings_count"]}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Gate durations (avg, from land logs):</span>
        <span class="stat-val">{gate_summary}</span>
      </div>
      <p class="metric-sub" style="margin-top: 10px;">Landings before 16 Oct 2026 come from git commit times; their gate durations were never logged.</p>
    </div>

    <!-- Card 2: Push to Post-Land Result -->
    <div class="card">
      <h2>2. Push to Post-Land Result <span class="tag">7d / 30d</span></h2>
      <div class="stat-row">
        <span class="stat-label">Post-Land Runs Tracked (7d):</span>
        <span class="stat-val">{len(w7["push_to_postland"])} runs</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Green / red / superseded / timed out:</span>
        <span class="stat-val">{pl_counts}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Avg full suite duration (timestamped runs):</span>
        <span class="stat-val">{pl_avg}</span>
      </div>
      <p class="metric-sub" style="margin-top: 10px;">Push commit timestamp correlated against post-land clean-copy results.</p>
    </div>

    <!-- Card 3: Reds by Cause -->
    <div class="card">
      <h2>3. Reds by Cause (7d) <span class="tag">F-tasks</span></h2>
      {render_bar_chart(reds_bars_7)}
      <div class="stat-row" style="margin-top: 8px;">
        <span class="stat-label">30-day Totals:</span>
        <span class="stat-val">Assert {reds30["assertion"]}, Timeout {reds30["timeout"]}, Kill {reds30["killed"]}, Throttle {reds30["throttled"]}</span>
      </div>
    </div>

    <!-- Card 4: Kills and Limits -->
    <div class="card">
      <h2>4. Kills & Limits Fired <span class="tag">Mechanisms</span></h2>
      <div class="stat-row">
        <span class="stat-label">Watchdog Hung Runs Killed (7d):</span>
        <span class="stat-val">{len([k for k in w7["kills_and_limits"] if k["mechanism"] == "watchdog_hung_post_land"])}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Quiet-Test Idle Kills (7d):</span>
        <span class="stat-val">{len([k for k in w7["kills_and_limits"] if k["mechanism"] == "quiet_test_idle_watchdog"])}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Housekeeping Stopped Browser (7d):</span>
        <span class="stat-val">{len([k for k in w7["kills_and_limits"] if k["mechanism"] == "housekeeping_stopped_browser"])}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Housekeeping Freed Slots (7d):</span>
        <span class="stat-val">{len([k for k in w7["kills_and_limits"] if k["mechanism"] == "housekeeping_freed_slot"])}</span>
      </div>
    </div>

    <!-- Card 5: Queue Waits -->
    <div class="card">
      <h2>5. Queue Waits <span class="tag">Admission / Locks</span></h2>
      <div class="stat-row">
        <span class="stat-label">Admission Slot Waits (7d count):</span>
        <span class="stat-val">{len(admit_waits)} waits</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Total Admission Wait Time:</span>
        <span class="stat-val">{sum(admit_waits)} s</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Suite Lock Contention Events:</span>
        <span class="stat-val">{len(suite_waits)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Budget Token Queue Events:</span>
        <span class="stat-val">{len(heavy_waits)}</span>
      </div>
    </div>

    <!-- Card 6: Memory Peaks vs Budget -->
    <div class="card">
      <h2>6. Memory Peaks vs Budget <span class="tag">budget.conf</span></h2>
      <div class="stat-row">
        <span class="stat-label">Post-Land Suite Reserve:</span>
        <span class="stat-val">1400 MB</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Small Jobs Pool (lint/typecheck):</span>
        <span class="stat-val">4000 MB</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">General Pool (browser/unit):</span>
        <span class="stat-val">5100 MB</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Measured Memory Samples (7d):</span>
        <span class="stat-val">{len(w7["memory_peaks"])}</span>
      </div>
    </div>

    <!-- Card 7: Delegated Jobs -->
    <div class="card">
      <h2>7. Delegated Jobs (Zoo) <span class="tag">7d: {len(del_7)} jobs</span></h2>
      <div class="stat-row">
        <span class="stat-label">Done / Failed / Killed:</span>
        <span class="stat-val">{del_7_done} / {del_7_failed} / {del_7_killed}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Retries:</span>
        <span class="stat-val">{del_7_retries} ({round(del_7_retries / max(len(del_7), 1) * 100, 1)}%)</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">Average Runtime:</span>
        <span class="stat-val">{del_7_avg} min</span>
      </div>
    </div>
  </div>

  <!-- Card 8: Slowest 20 Specs -->
  <div class="card" style="margin-bottom: 20px;">
    <h2>8. Test Durations: Slowest 20 Specs <span class="tag">Max Duration</span></h2>
    <div style="overflow-x: auto;">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Spec File</th>
            <th>Max Duration</th>
            <th>Avg Duration</th>
            <th>Runs</th>
          </tr>
        </thead>
        <tbody>
          {"".join(slow_rows) if slow_rows else '<tr><td colspan="5" class="muted">No spec runs recorded</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>"""
    return html

if __name__ == "__main__":
    main()
