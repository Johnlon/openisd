#!/usr/bin/env bash
# SDLC S3: one watchdog tick. A systemd user timer runs it every 5 min (watchdog.timer). Idempotent;
# two ticks never overlap (flock). Every action is logged to WATCHDOG_LOG with a UTC timestamp.
# Checks, in order: (a) housekeeping, (b) hung post-land run, (b2) main untested with no run alive, (c) open F, (d) unacknowledged zoo-run
# result, (e) gate refused twice in an hour, (f) merged clean worktrees.
# Processes are found by recorded pid and start time, never by command text.
# Env overrides (tests use scratch dirs): WATCHDOG_REPO WORKSPACE WATCHDOG_LOG WATCHDOG_LEADER
#   WATCHDOG_STATE WATCHDOG_HOLDER WATCHDOG_POST_LAND_LOG WATCHDOG_REFUSALS WATCHDOG_HOUSEKEEPING
#   WATCHDOG_NOW (epoch) WATCHDOG_HUNG_MIN (20) WATCHDOG_HUNG_S WATCHDOG_F_AGE_S (1800)
#   WATCHDOG_RUN_SH WATCHDOG_STALL_S (600) WATCHDOG_REALERT_S (1800) WATCHDOG_REFUSE_WINDOW_S (3600) WATCHDOG_GRACE_S (10)
#   WATCHDOG_WT_MIN_AGE_S (3600) WATCHDOG_CPU_SLACK_TICKS (= one second of CPU).
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=../admit/record.sh
. "$ROOT/scripts/admit/record.sh"

REPO="${WATCHDOG_REPO:-/home/john/work/winisd/openisd}"
WORKSPACE="${WORKSPACE:-/home/john/work/winisd}"
LEADER="${WATCHDOG_LEADER:-lots}"
LOG="${WATCHDOG_LOG:-$ROOT/build/test-logs/watchdog.log}"
STATE="${WATCHDOG_STATE:-$OPENISD_RUNTIME_DIR/watchdog}"
ASK="$WORKSPACE/zoo/ASK.md"
JOBS="$WORKSPACE/zoo/state/jobs"
HUNG_S="${WATCHDOG_HUNG_S:-$(( ${WATCHDOG_HUNG_MIN:-20} * 60 ))}"
F_AGE_S="${WATCHDOG_F_AGE_S:-1800}"
REALERT_S="${WATCHDOG_REALERT_S:-1800}"
REFUSE_WINDOW_S="${WATCHDOG_REFUSE_WINDOW_S:-3600}"
GRACE_S="${WATCHDOG_GRACE_S:-10}"
WT_MIN_AGE_S="${WATCHDOG_WT_MIN_AGE_S:-3600}"
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

mkdir -p "$(dirname "$LOG")" "$STATE/alerts" || die "cannot create $STATE or the log dir"
exec 7> "$STATE/watchdog.lock" || die "cannot open $STATE/watchdog.lock"
flock -n 7 || { echo "watchdog: another tick is running"; exit 0; }

# --- alerts -------------------------------------------------------------------------------
has_window() { # has_window <name>: the tmux session agents has a window of that name
  tmux list-windows -t agents -F '#{window_name}' 2> /dev/null | grep -qxF -- "$1"
}
alert() { # alert <owner> <text>: type it into the owner's window; else ASK.md and tell the leader
  local who="$1" text="WATCHDOG: $2"
  if has_window "$who"; then
    tmux send-keys -t "agents:$who" "$text" Enter && log "alert typed into agents:$who: $text" \
      || log "alert FAILED (tmux send-keys) for $who: $text"
    return
  fi
  mkdir -p "$(dirname "$ASK")" && printf '%s | watchdog: no window %s: %s\n' "$(date '+%F %T')" "$who" "$text" >> "$ASK" \
    && log "alert for $who written to $ASK (no window): $text"
  if [ "$who" != "$LEADER" ] && has_window "$LEADER"; then
    tmux send-keys -t "agents:$LEADER" "$text (no window for $who)" Enter \
      && log "alert typed into agents:$LEADER (no window for $who): $text"
  fi
}
due() { # due <key>: true when the last alert for <key> was >= REALERT_S ago; records now when true
  local f="$STATE/alerts/$1" last t; t=$(now)
  last=$(cat "$f" 2> /dev/null || echo 0)
  [ $((t - last)) -ge "$REALERT_S" ] || return 1
  echo "$t" > "$f"
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
  local idle=$((t - ${6:-$t}))
  if [ "$idle" -lt "$HUNG_S" ]; then
    log "post-land run $pid ($sha) quiet for ${idle}s of ${HUNG_S}s"; return 0
  fi
  log "post-land run $pid ($sha) hung: no log growth and under 1 s of CPU in ${idle}s; killing group $pid"
  kill -TERM -- "-$pid" 2> /dev/null
  local i=0                                   # bounded: leaves as soon as the leader is gone
  while [ "$i" -lt "$GRACE_S" ] && [ -n "$(admit_starttime "$pid")" ]; do sleep 1; i=$((i + 1)); done
  kill -KILL -- "-$pid" 2> /dev/null
  rm -f "$holder" "$STATE/hung.state"
  log "post-land run $pid killed (TERM, KILL after ${i}s), holder removed"
  alert "$LEADER" "post-land run for ${sha:0:10} was hung ${idle}s and is killed; rerun: bash scripts/land/post-land/run.sh ${sha:0:10}"
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
  run="${WATCHDOG_RUN_SH:-$REPO/scripts/land/post-land/run.sh}"
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
  ( cd "$REPO" && setsid bash "$run" "$main" >> "$plog" 2>&1 < /dev/null & )
}
check_untested_main

# --- (c) open F older than the limit ----------------------------------------------------------
check_open_fs() {
  local f id owner age t; t=$(now)
  for f in "$REPO"/tasks/fixes/F*.yml; do
    [ -f "$f" ] || continue
    [ "$(field "$f" status)" = open ] || continue
    age=$((t - $(stat -c %Y "$f")))
    [ "$age" -ge "$F_AGE_S" ] || continue
    id=$(field "$f" id); owner=$(field "$f" owner)
    case "$owner" in ''|Johnlon) owner="$LEADER" ;; esac
    due "F-$id" || continue
    alert "$owner" "$id: open $((age / 60)) min; take it or say who has it, then close it with its fix"
  done
}
check_open_fs

# --- (d) zoo-run result nobody acknowledged ---------------------------------------------------
check_results() {
  local id name
  [ -f "$ASK" ] || return 0
  while read -r id name; do
    [ -n "$id" ] || continue
    grep -qx 'delivered=yes' "$JOBS/$id.env" 2> /dev/null && continue
    due "result-$id" || continue
    alert "$name" "zoo result $id is unread; read its summary under zoo/results, then run: zoo-run.sh ack $id"
  done < <(sed -n 's/^.*result for \([^ ]*\) NOT DELIVERED.*zoo-run\.sh ack \([^ ]*\)[[:space:]]*$/\2 \1/p' "$ASK" | sort -u)
}
check_results

# --- (e) gate refused twice in an hour -> an infra F --------------------------------------------
# $REFUSALS lines: "<epoch> <gate> [<task>]", appended by scripts/land/record-refusal.sh.
check_refusals() {
  local t gate n num f
  [ -s "$REFUSALS" ] || return 0
  t=$(now)
  while read -r gate n; do
    [ "$n" -ge 2 ] || continue
    f=$(grep -lx 'label: infra' "$REPO"/tasks/fixes/F*.yml 2> /dev/null | while read -r c; do
          [ "$(field "$c" status)" = open ] && [ "$(field "$c" gate)" = "$gate" ] && echo "$c"
        done | head -1)
    [ -z "$f" ] || continue
    num=$(ls "$REPO"/tasks/fixes/ 2> /dev/null | sed -n 's/^F\([0-9]*\)\.yml$/\1/p' | sort -n | tail -1)
    num=$(( ${num:-0} + 1 ))
    f="$REPO/tasks/fixes/F$num.yml"
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
    alert "$LEADER" "F$num (infra): gate $gate refused twice in an hour; the file is in $REPO/tasks/fixes, land it"
  done < <(awk -v now="$(now)" -v w="$REFUSE_WINDOW_S" '$1 >= now - w { c[$2]++ } END { for (g in c) print g, c[g] }' "$REFUSALS")
}
check_refusals

# --- (f) merged clean worktrees ---------------------------------------------------------------
check_worktrees() {
  local wt="" branch="" first=1 line t gdir age
  t=$(now)
  prune_one() {
    [ -n "$wt" ] && [ -n "$branch" ] || return 0
    case "$wt" in *.postland*) return 0 ;; esac
    case "$branch" in main|master) return 0 ;; esac
    git -C "$REPO" merge-base --is-ancestor "refs/heads/$branch" origin/main 2> /dev/null || return 0
    [ -z "$(git -C "$wt" status --porcelain 2> /dev/null)" ] || return 0
    gdir=$(git -C "$wt" rev-parse --absolute-git-dir 2> /dev/null) || return 0
    age=$((t - $(stat -c %Y "$gdir/HEAD" 2> /dev/null || echo "$t")))
    [ "$age" -ge "$WT_MIN_AGE_S" ] || return 0
    if git -C "$REPO" worktree remove "$wt" 2> /dev/null; then
      log "removed merged clean worktree $wt (branch $branch)"
      git -C "$REPO" branch -d "$branch" > /dev/null 2>&1 && log "deleted merged branch $branch" \
        || log "branch $branch kept (git branch -d refused)"
    else
      log "worktree $wt not removed (git worktree remove refused)"
    fi
  }
  while IFS= read -r line; do
    case "$line" in
      "worktree "*) prune_one; wt="${line#worktree }"; branch=""
                    if [ "$first" = 1 ]; then first=0; wt=""; fi ;;
      "branch refs/heads/"*) branch="${line#branch refs/heads/}" ;;
      "") prune_one; wt=""; branch="" ;;
    esac
  done < <(git -C "$REPO" worktree list --porcelain 2> /dev/null; echo)
}
check_worktrees
log "tick done"
