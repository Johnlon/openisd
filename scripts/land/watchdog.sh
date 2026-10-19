#!/usr/bin/env bash
# SDLC S3: one watchdog tick. A systemd user timer runs it every 5 min (watchdog.timer). Idempotent;
# two ticks never overlap (flock). Every action is logged to WATCHDOG_LOG with a UTC timestamp.
# Checks, in order: (a) housekeeping, (b) hung post-land run, (b2) main untested with no run alive, (b3) the
# main folder at the last passed commit (sync-main-folder.sh), (c) open F, (d) unacknowledged zoo-run
# result, (e) gate refused twice in an hour, (f) landed and abandoned branches, worktrees and leftover
# folders removed (scripts/land/tidy-branches.sh).
# Processes are found by recorded pid and start time, never by command text.
# Env overrides (tests use scratch dirs): WATCHDOG_REPO WORKSPACE WATCHDOG_LOG WATCHDOG_LEADER
#   WATCHDOG_STATE WATCHDOG_HOLDER WATCHDOG_POST_LAND_LOG WATCHDOG_REFUSALS WATCHDOG_HOUSEKEEPING
#   WATCHDOG_NOW (epoch) WATCHDOG_HUNG_MIN (20) WATCHDOG_HUNG_S WATCHDOG_F_AGE_S (1800)
#   WATCHDOG_RUN_SH WATCHDOG_STALL_S (600) WATCHDOG_REFUSE_WINDOW_S (3600) WATCHDOG_GRACE_S (10)
#   WATCHDOG_CPU_SLACK_TICKS (= one second of CPU) WATCHDOG_COORDINATOR (fable)
#   WATCHDOG_SESSIONS (Claude Code's registry, $HOME/.claude/sessions).
set -uo pipefail
REPO="${WATCHDOG_REPO:-/home/john/work/winisd/openisd}"
# The scripts and settings are origin/main's own, never the main checkout's files: that checkout can lag
# main (17 Oct: 12 commits behind, held by another session's uncommitted files). Each tick runs from a
# snapshot of origin/main's scripts/ and land.conf (WATCHDOG_TOOLS), removed when the tick ends; REPO is
# used only for git and for the logs under build/. A test points WATCHDOG_TOOLS at the tree under test.
if [ -z "${WATCHDOG_TOOLS:-}" ]; then
  timeout 60 git -C "$REPO" fetch -q origin main 2> /dev/null || echo "watchdog: cannot fetch origin/main; using the local origin/main" >&2
  tools="$(mktemp -d "${TMPDIR:-/tmp}/watchdog-tools.XXXXXX")" || exit 2
  if ! git -C "$REPO" archive origin/main scripts land.conf | tar -x -C "$tools"; then
    rm -rf "$tools"; echo "watchdog: cannot read origin/main's scripts" >&2; exit 2
  fi
  WATCHDOG_TOOLS="$tools" bash "$tools/scripts/land/watchdog.sh" "$@"; rc=$?
  rm -rf "$tools"
  exit "$rc"
fi
ROOT="$WATCHDOG_TOOLS"
# shellcheck source=../admit/record.sh
. "$ROOT/scripts/admit/record.sh"
. "$ROOT/scripts/lib/ts-log.sh"
export OPENISD_RUN_ID="${OPENISD_RUN_ID:-$$-$(date +%s)-$RANDOM}"
run_start "watchdog"

WORKSPACE="${WORKSPACE:-/home/john/work/winisd}"
LEADER="${WATCHDOG_LEADER:-lots}"
COORDINATOR="${WATCHDOG_COORDINATOR:-fable}"
# Live sessions (T476): Claude Code's own registry, one file SESSIONS/<pid>.json per session with "name", "pid" and
# "procStart" (the process start time in clock ticks, field 22 of /proc/<pid>/stat). An owner is live when a file names
# it, its pid exists and its start time equals procStart (guards pid reuse). Files of dead pids are ignored. When the
# directory exists, an alert whose named owner is not live goes to the coordinator instead (the owner's session ended
# and nobody would read it: 19 Oct, the alerts for lots sat unread for hours). No directory: owners are not tracked
# and every alert goes to its owner.
SESSIONS="${WATCHDOG_SESSIONS:-$HOME/.claude/sessions}"
ALERTS="${WATCHDOG_ALERTS:-$OPENISD_RUNTIME_DIR/agent-alerts}"
LOG="${WATCHDOG_LOG:-$REPO/build/test-logs/watchdog.log}"
export HOUSEKEEPING_LOG="${HOUSEKEEPING_LOG:-$REPO/build/test-logs/housekeeping.log}"
STATE="${WATCHDOG_STATE:-$OPENISD_RUNTIME_DIR/watchdog}"
ASK="$WORKSPACE/zoo/ASK.md"
JOBS="$WORKSPACE/zoo/state/jobs"
HUNG_S="${WATCHDOG_HUNG_S:-$(( ${WATCHDOG_HUNG_MIN:-20} * 60 ))}"
F_AGE_S="${WATCHDOG_F_AGE_S:-1800}"
REFUSE_WINDOW_S="${WATCHDOG_REFUSE_WINDOW_S:-3600}"
GRACE_S="${WATCHDOG_GRACE_S:-10}"
HZ=$(getconf CLK_TCK 2> /dev/null || echo 100)
CPU_SLACK="${WATCHDOG_CPU_SLACK_TICKS:-$HZ}"
REFUSALS="${WATCHDOG_REFUSALS:-$OPENISD_RUNTIME_DIR/land-refusals.log}"
HOUSEKEEPING="${WATCHDOG_HOUSEKEEPING:-$ROOT/scripts/housekeeping.sh}"

now() { if [ -n "${WATCHDOG_NOW:-}" ]; then echo "$WATCHDOG_NOW"; else date +%s; fi; }
die() { echo "watchdog: $*" >&2; exit 2; }  # a failed tick must be loud
log() {
  echo "$1"
  printf '%s watchdog: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" >> "$LOG" || die "cannot write log $LOG"
}
field() { sed -n "s/^$2: *//p" "$1" 2> /dev/null | head -1; }  # field <yml> <key>
# The fixes tasks as origin/main has them, one path per line (never the main checkout's copies).
main_fixes() { git -C "$REPO" ls-tree --name-only origin/main tasks/fixes/ 2> /dev/null | grep -E '/F[0-9]+\.yml$'; }
main_field() { git -C "$REPO" show "origin/main:$1" 2> /dev/null | sed -n "s/^$2: *//p" | head -1; }  # main_field <path> <key>

mkdir -p "$(dirname "$LOG")" "$STATE/alerts" || die "cannot create $STATE or the log dir"
exec 7> "$STATE/watchdog.lock" || die "cannot open $STATE/watchdog.lock"
flock -n 7 || { echo "watchdog: another tick is running"; exit 0; }

# --- alerts -------------------------------------------------------------------------------
# The agent inbox (T333). An alert is a file ALERTS/<key>.alert holding "for <owner>: <text>". The Claude Code gate
# hook (_agent_files/bin/agent_alerts.py, run by run_gates.py before every tool call) shows each live alert to
# every agent session, at most every 5 min, until it is over. A problem that still holds is re-written every tick;
# an alert not re-written for 10 min is over. No tmux, no ASK.md, no inbox (John, 17 Oct 2026: "our scripts cannot
# rely on tmux at all"; "only stuff we control or which is part of Claude can be used").
owner_live() { # owner_live <name>: has that session a live process (pid and start time match)?
  local pid start
  [ -d "$SESSIONS" ] || return 0
  while read -r pid start; do
    [ -n "$pid" ] && [ "$(admit_starttime "$pid")" = "$start" ] && return 0
  done < <(python3 -I - "$SESSIONS" "$1" 2> /dev/null << 'PY'
import glob, json, os, sys
for f in glob.glob(os.path.join(sys.argv[1], "*.json")):
    try:
        d = json.load(open(f))
        if d["name"] == sys.argv[2]:
            print(int(d["pid"]), d["procStart"])
    except (OSError, ValueError, KeyError, TypeError):
        pass
PY
)
  return 1
}
alert() { # alert <key> <owner> <text>
  local f="$ALERTS/$1.alert" owner="$2" line
  if [ "$owner" != "$COORDINATOR" ] && ! owner_live "$owner"; then
    log "alert $1: owner $owner has no live session; addressed to $COORDINATOR"
    set -- "$1" "$COORDINATOR" "$3 (owner $owner has no live session)"
  fi
  line="for $2: $3"
  mkdir -p "$ALERTS" || { log "alert FAILED (cannot create $ALERTS) for $2: $3"; return; }
  [ "$(cat "$f" 2> /dev/null)" = "$line" ] || log "alert $1 for $2: $3"
  printf '%s\n' "$line" > "$f.tmp" && mv -f "$f.tmp" "$f" || log "alert FAILED (cannot write $f) for $2: $3"
}

# --- (a) housekeeping: grants of dead owners ------------------------------------------------
out=$(timeout 120 bash "$HOUSEKEEPING" 2>&1); rc=$?
log "housekeeping exit $rc: $(printf '%s' "$out" | tail -n 1)"

# --- (b) hung post-land run -----------------------------------------------------------------
tree_cpu() { # tree_cpu <pid>: utime+stime in clock ticks over <pid> and every descendant.
  # Descendants, not the process group: run.sh starts the suite under set -m, so the suite is its
  # own group and the holder's group alone sits idle for the whole run (12 Oct: a live full run
  # was "quiet for 632s of 1200s" and would have been killed at 20 min).
  local root="$1" p s total=0 kids pid
  declare -A PPID_OF TICKS
  for p in /proc/[0-9]*; do
    s=$(cat "$p/stat" 2> /dev/null) || continue
    pid=${p#/proc/}; s=${s##*) }; set -- $s     # $2 ppid, $12 utime, $13 stime
    PPID_OF[$pid]=$2; TICKS[$pid]=$(( ${12} + ${13} ))
  done
  kids="$root"
  while [ -n "$kids" ]; do
    local next=""
    for pid in $kids; do
      total=$((total + ${TICKS[$pid]:-0}))
      for p in "${!PPID_OF[@]}"; do [ "${PPID_OF[$p]}" = "$pid" ] && next="$next $p"; done
    done
    kids="$next"
  done
  echo "$total"
}
check_hung() {
  local holder lock plog pid start sha cur size mtime cpu prev t
  lock="${POST_LAND_LOCK:-$OPENISD_RUNTIME_DIR/post-land.lock}"
  holder="${WATCHDOG_HOLDER:-$lock.holder}"
  plog="${WATCHDOG_POST_LAND_LOG:-$( . "$ROOT/land.conf"; echo "${POST_LAND_DIR:-}" )/post-land.log}"
  [ -s "$holder" ] || { rm -f "$STATE/hung.state"; return 0; }
  read -r pid start sha < "$holder"
  cur=$(admit_starttime "${pid:-0}")
  if [ -z "$cur" ] || [ "$cur" != "$start" ]; then
    rm -f "$STATE/hung.state"; log "post-land holder $pid is not running (stale holder file); left to the next run"; return 0
  fi
  # The suite waiting for browser runs to end (scripts/suite-lock.sh) is idle on purpose: not hung until
  # it has waited three thresholds, which a waiting suite that no new run can overtake never does.
  local wpid wstart wsince idle why="no log growth and under 1 s of CPU"
  if read -r wpid wstart < "${SUITE_RUN_LOCK}.waiting" 2> /dev/null && [ -n "${wpid:-}" ] \
     && [ "$(admit_starttime "$wpid")" = "${wstart:-}" ]; then
    wsince=$(( $(now) - $(stat -c %Y "${SUITE_RUN_LOCK}.waiting" 2> /dev/null || now) ))
    if [ "$wsince" -lt $((HUNG_S * 3)) ]; then
      rm -f "$STATE/hung.state"
      log "post-land run $pid ($sha) is waiting for browser runs to end (${wsince}s); not hung"; return 0
    fi
    idle=$wsince; why="waiting for browser runs to end, past three thresholds,"  # the wait is the idle time
  fi
  if [ -z "${idle:-}" ]; then
    size=$(stat -c %s "$plog" 2> /dev/null || echo 0); mtime=$(stat -c %Y "$plog" 2> /dev/null || echo 0)
    cpu=$(tree_cpu "$pid"); t=$(now)
    # state: pid start size mtime cpu since
    prev=$(cat "$STATE/hung.state" 2> /dev/null || true)
    set -- $prev
    if [ "${1:-}" != "$pid" ] || [ "${2:-}" != "$start" ] || [ "${3:-}" != "$size" ] || [ "${4:-}" != "$mtime" ] \
       || [ $((cpu - ${5:-0})) -ge "$CPU_SLACK" ]; then
      echo "$pid $start $size $mtime $cpu $t" > "$STATE/hung.state"
      log "post-land run $pid ($sha) is alive and moving (log $size bytes, cpu $cpu ticks)"; return 0
    fi
    idle=$((t - ${6:-$t}))
    if [ "$idle" -lt "$HUNG_S" ]; then
      log "post-land run $pid ($sha) quiet for ${idle}s of ${HUNG_S}s"; return 0
    fi
  fi
  log "post-land run $pid ($sha) hung: $why in ${idle}s; killing group $pid"
  kill -TERM -- "-$pid" 2> /dev/null
  local i=0                                   # bounded: leaves as soon as the leader is gone
  while [ "$i" -lt "$GRACE_S" ] && [ -n "$(admit_starttime "$pid")" ]; do sleep 1; i=$((i + 1)); done
  kill -KILL -- "-$pid" 2> /dev/null
  rm -f "$holder" "$STATE/hung.state"
  log "post-land run $pid killed (TERM, KILL after ${i}s), holder removed"
  alert "hung-${sha:0:10}" "$LEADER" "post-land run for ${sha:0:10} was hung ${idle}s and is killed; rerun: bash scripts/land/post-land/run.sh ${sha:0:10}"
}
check_hung

# --- (b2) main has a commit no post-land run has tested and none is alive: start one ---------------
# A run can be gone without leaving a result (its own process killed, the machine restarted, 16 Oct:
# an OOM kill took a run and nothing replaced it for hours). The commit must be older than STALL_S, so
# a run that land.sh is only now starting is not raced. A run is alive when its holder is, when it
# holds the post-land lock, or when a waiting run's record is held.
check_untested_main() {
  local lock holder plog run main tested ctime hpid hstart hsha rec
  lock="${POST_LAND_LOCK:-$OPENISD_RUNTIME_DIR/post-land.lock}"
  holder="${WATCHDOG_HOLDER:-$lock.holder}"
  plog="${WATCHDOG_POST_LAND_LOG:-$( . "$ROOT/land.conf"; echo "${POST_LAND_DIR:-}" )/post-land.log}"
  # The snapshot is removed when this tick ends, which can be before the started run reads its first
  # line: the run starts from a copy in STATE, and re-starts itself from its own origin/main snapshot.
  run="${WATCHDOG_RUN_SH:-$STATE/post-land-run.sh}"
  [ -n "${WATCHDOG_RUN_SH:-}" ] || cp "$ROOT/scripts/land/post-land/run.sh" "$run" || { log "cannot copy run.sh to $run"; return 0; }
  timeout 60 git -C "$REPO" fetch -q origin main 2> /dev/null || { log "fetch of origin/main failed; no untested-main check this tick"; return 0; }
  main=$(git -C "$REPO" rev-parse origin/main 2> /dev/null) || return 0
  tested=$(cat "$lock.tested" 2> /dev/null)
  [ "$tested" != "$main" ] || return 0
  [ -z "$tested" ] || ! git -C "$REPO" merge-base --is-ancestor "$main" "$tested" 2> /dev/null || return 0
  ctime=$(git -C "$REPO" log -1 --format=%ct "$main" 2> /dev/null || echo 0)
  [ $(( $(now) - ctime )) -ge "${WATCHDOG_STALL_S:-600}" ] || return 0
  if [ -s "$holder" ]; then
    read -r hpid hstart hsha < "$holder"
    [ -z "$(admit_starttime "${hpid:-0}")" ] || [ "$(admit_starttime "${hpid:-0}")" != "$hstart" ] || return 0
  fi
  ( flock -n 9 ) 9> "$lock" 2> /dev/null || return 0
  for rec in "$lock.pending"/*; do
    [ -e "$rec" ] || continue
    ( flock -n 7 ) 7< "$rec" 2> /dev/null || return 0
  done
  log "main ${main:0:10} is untested (last tested ${tested:0:10}) and no post-land run is alive; starting one"
  # The tick is a systemd oneshot service: when it ends, systemd kills every process still in its
  # cgroup, setsid or not (16 Oct 2026: three runs started here died at once and were recorded red).
  # The run therefore starts as a transient service of the user manager, outside the tick's cgroup.
  if command -v systemd-run > /dev/null 2>&1; then
    systemd-run --user --quiet --collect --unit="openisd-postland-${main:0:10}-$(now)" \
      --working-directory="$REPO" --property=StandardOutput="append:$plog" --property=StandardError="append:$plog" \
      -- bash "$run" "$main" || log "systemd-run failed to start the post-land run on ${main:0:10}"
  else
    ( cd "$REPO" && setsid bash "$run" "$main" >> "$plog" 2>&1 < /dev/null & )
  fi
}
check_untested_main

# --- (b3) the main folder and the preview copy at the last passed commit (T328) ---------------------------------
# A copy held (its own commits conflict with main, or are not on main) is an agent alert every tick until it is
# fixed (John, 17 Oct 2026: "if the land fails then no one acts"). land.sh also stops the landing agent on it.
check_main_folder() {
  local out why
  out="$(bash "$ROOT/scripts/land/sync-main-folder.sh" "$REPO" 2>&1)" && return 0
  why="$(grep -E 'CONFLICT|of its own|to fix|in progress|cannot|FAILED' <<< "$out" | sed 's/^.*sync-main-folder: //' | tr '\n' ' ')"
  log "main folder held: $why"
  alert main-folder "$LEADER" "the main folder cannot update to main: $why"
}
check_main_folder

# --- (c) open F older than the limit ----------------------------------------------------------
check_open_fs() {
  local f id owner age t; t=$(now)
  # Age: since the last commit that touched the F on origin/main.
  for f in $(main_fixes); do
    [ "$(main_field "$f" status)" = open ] || continue
    age=$((t - $(git -C "$REPO" log -1 --format=%ct origin/main -- "$f" 2> /dev/null || echo "$t")))
    [ "$age" -ge "$F_AGE_S" ] || continue
    id=$(main_field "$f" id); owner=$(main_field "$f" owner)
    case "$owner" in ''|Johnlon) owner="$LEADER" ;; esac
    alert "F-$id" "$owner" "$id: open $((age / 60)) min; take it or say who has it, then close it with its fix"
  done
}
check_open_fs

# --- (d) zoo-run result nobody acknowledged ---------------------------------------------------
check_results() {
  local id name
  [ -f "$ASK" ] || return 0
  while read -r id name; do
    [ -n "$id" ] || continue
    if grep -qx 'delivered=yes' "$JOBS/$id.env" 2> /dev/null; then rm -f "$ALERTS/result-$id.alert"; continue; fi
    alert "result-$id" "$name" "zoo result $id is unread; read its summary under zoo/results, then run: zoo-run.sh ack $id"
  done < <(sed -n 's/^.*result for \([^ ]*\) NOT DELIVERED.*zoo-run\.sh ack \([^ ]*\)[[:space:]]*$/\2 \1/p' "$ASK" | sort -u)
}
check_results

# --- (e) gate refused twice in an hour -> an infra F --------------------------------------------
# $REFUSALS lines: "<epoch> <gate> [<task>]", appended by scripts/land/record-refusal.sh.
# The F is written to $STATE/infra, never into the main checkout (a file there keeps it from following
# main); the alert names the file to land from a task worktree. One per gate: none is written while an
# open infra F for the gate is on origin/main or waiting in $STATE/infra.
check_refusals() {
  local t gate n num f c
  [ -s "$REFUSALS" ] || return 0
  t=$(now)
  mkdir -p "$STATE/infra"
  while read -r gate n; do
    [ "$n" -ge 2 ] || continue
    f=""
    for c in $(main_fixes); do
      [ "$(main_field "$c" label)" = infra ] && [ "$(main_field "$c" status)" = open ] && [ "$(main_field "$c" gate)" = "$gate" ] && { f="$c"; break; }
    done
    for c in "$STATE"/infra/F*.yml; do
      [ -f "$c" ] && [ "$(field "$c" gate)" = "$gate" ] && { f="$c"; break; }
    done
    [ -z "$f" ] || continue
    num=$( { main_fixes | sed -n 's#^.*/F\([0-9]*\)\.yml$#\1#p'; ls "$STATE/infra" 2> /dev/null | sed -n 's/^F\([0-9]*\)\.yml$/\1/p'; } | sort -n | tail -1)
    num=$(( ${num:-0} + 1 ))
    f="$STATE/infra/F$num.yml"
    cat > "$f" << YML
id: F$num
owner: $LEADER
status: open
label: infra
gate: $gate
goal: gate $gate refused a landing twice within an hour; find the cause and fix the infrastructure
commits: |

failing: |
  gate $gate refused twice (see $REFUSALS)
output: |

YML
    log "gate $gate refused $n times in $((REFUSE_WINDOW_S / 60)) min; wrote $f (land it from a worktree)"
    echo "$t" > "$STATE/alerts/F-F$num"
    alert "infra-F$num" "$LEADER" "F$num (infra): gate $gate refused twice in an hour; land $f as tasks/fixes/F$num.yml from a task worktree"
  done < <(awk -v now="$(now)" -v w="$REFUSE_WINDOW_S" '$1 >= now - w { c[$2]++ } END { for (g in c) print g, c[g] }' "$REFUSALS")
}
check_refusals

# --- (f) landed and abandoned branches, worktrees and leftover folders (tidy-branches.sh, T334) ---------
# A "held: <text>" line from tidy-branches.sh is an agent alert.
check_worktrees() {
  local out held
  out="$(bash "$ROOT/scripts/land/tidy-branches.sh" "$REPO" 2>&1)" || log "tidy-branches failed: $(tail -2 <<< "$out" | tr '\n' ' ')"
  while IFS= read -r held; do
    [ -n "$held" ] && alert "held-$(md5sum <<< "$held" | cut -c1-8)" "$LEADER" "$held"
  done < <(sed -n 's/^held: //p' <<< "$out")
}
check_worktrees
log "tick done"
run_end "watchdog" 0
