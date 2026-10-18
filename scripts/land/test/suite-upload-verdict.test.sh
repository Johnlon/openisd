#!/usr/bin/env bash
# .github/workflows/suite.yml: only the test steps decide a job's verdict. The log and report uploads (unit-log-*,
# report-*, failures-*) feed shard timing and diagnosis; the gate reads none of them. A failed upload must
# therefore not fail the job, and must show as a named warning in the run summary (T405: run 39142054368, every
# test green, red on GitHub "server is busy" in the report-<n> upload).
# The test-app upload stays gating: the browser shards download it. No test step may carry continue-on-error.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
python3 - "$REPO/.github/workflows/suite.yml" <<'PY'
import sys, yaml

GATING_UPLOADS = {"test-app"}
wf = yaml.safe_load(open(sys.argv[1]))
fails = []
checked = 0
for job, body in wf["jobs"].items():
    steps = body.get("steps", [])
    for i, s in enumerate(steps):
        uses = s.get("uses", "")
        label = f"{job}[{i}] {s.get('name') or s.get('run') or uses}"[:90]
        if not uses.startswith("actions/upload-artifact"):
            if s.get("continue-on-error"):
                fails.append(f"{label}: a non-upload step carries continue-on-error")
            continue
        art = s["with"]["name"]
        if any(art.startswith(g) for g in GATING_UPLOADS):
            if s.get("continue-on-error"):
                fails.append(f"{label}: gating upload {art} must not be continue-on-error")
            continue
        checked += 1
        if s.get("continue-on-error") is not True:
            fails.append(f"{label}: upload {art} lacks continue-on-error: true")
        sid = s.get("id")
        if not sid:
            fails.append(f"{label}: upload {art} has no id")
            continue
        nxt = steps[i + 1] if i + 1 < len(steps) else {}
        cond = str(nxt.get("if", ""))
        run = str(nxt.get("run", ""))
        if f"steps.{sid}.outcome == 'failure'" not in cond:
            fails.append(f"{label}: next step does not run on steps.{sid}.outcome == 'failure'")
        if "::warning" not in run or "GITHUB_STEP_SUMMARY" not in run or art.split("$")[0] not in run:
            fails.append(f"{label}: next step must emit ::warning and a GITHUB_STEP_SUMMARY line naming {art}")
if checked == 0:
    fails.append("no non-gating upload step found; the test checks nothing")
for f in fails:
    print("FAIL", f)
print(f"checked {checked} uploads, {len(fails)} failures")
sys.exit(1 if fails else 0)
PY
