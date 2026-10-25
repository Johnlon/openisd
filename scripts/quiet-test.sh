#!/usr/bin/env bash
# quiet-test.sh — run any test/typecheck/gate command; print only what is not a pass.
#
#   bash scripts/quiet-test.sh npx vitest run packages/design/test/foo.test.ts
#   bash scripts/quiet-test.sh npm run typecheck
#   bash scripts/quiet-test.sh npx playwright test packages/ui/test/ui/foo.browser.spec.ts
#
# The full output goes to build/test-logs/<timestamp>.log. Stdout gets the log path, every line
# that is not a passing-test trace, capped at QUIET_MAX_LINES (default 150), and the exit code
# is the command's. Read the log file only for a named failing test.
set -uo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: quiet-test.sh <command...>" >&2
  exit 2
fi

cd "$(dirname "${BASH_SOURCE[0]}")/.."
# Memory admission: the job starts when its measured cost fits its pool (scripts/budget.conf), else it waits.
BUDGET_SELF="${BASH_SOURCE[0]}" . scripts/budget-enter.sh "$@"
# Targeted runs and gates take no heavy lane (T044): enter heavy.slice directly so ~/bin/npx
# skips the lane queue. Only --slow runs (scripts/admit.sh) wait for a turn.
case "$(cat /proc/self/cgroup 2>/dev/null)" in
  *heavy.slice*) ;;
  *) exec bash scripts/heavy.sh bash "${BASH_SOURCE[0]}" "$@" ;;
esac
LOG_DIR="${QUIET_LOG_DIR:-build/test-logs}"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/$(date +%Y%m%d-%H%M%S)-$$.log"
MAX="${QUIET_MAX_LINES:-150}"

# vitest: quiet reporter unless the caller chose one. NOT done for playwright: a CLI --reporter
# replaces playwright.config.js's reporters, which would switch off the skip-is-a-fail gate and
# the json/telemetry reporters — playwright output is only grep-filtered below.
# A hung run can be inspected without killing it: `kill -USR2 <pid>` makes any node process in
# the run write a diagnostic report (JS stack, open handles) to build/test-reports/.
mkdir -p build/test-reports
export NODE_OPTIONS="${NODE_OPTIONS:-} --report-on-signal --report-signal=SIGUSR2 --report-directory=build/test-reports"
ARGS=("$@")
# Inside heavy.slice the funnel has done its work: `npx <tool>` would only add ~5 s of npm start-up
# (measured 7.9 s against 2.3 s for the binary, 11 Oct 2026, SDLC S9). Call the installed binary.
if [ "${ARGS[0]:-}" = npx ] && [ -x "node_modules/.bin/${ARGS[1]:-}" ]; then
  ARGS=("node_modules/.bin/${ARGS[1]}" "${ARGS[@]:2}")
fi
case " $* " in
  *vitest*)
    if [ "${OPENISD_FULL_GATE:-}" != "1" ] && ! printf '%s\n' "$@" | grep -qE '\.(test|spec)\.(ts|js|mjs)$|/test/'; then
      echo "quiet-test: a vitest run names its target specs; the full suite runs only in the post-land run (.claude/rules/verify.md)." >&2
      exit 1
    fi
    ;;
esac
# Only commands that start Chromium go through the machine's one admission slot (scripts/admit.sh):
# concurrent browser runs harm each other. Lint, typecheck and unit tests conflict with nothing and
# run at once. admit.sh exports ADMIT_TOKEN, so the re-exec happens once.
has_target() { printf '%s\n' "$@" | grep -qE '\.(test|spec)\.(ts|js|mjs)$|/test/'; }
needs_slot() {
  case "$1 ${2:-} ${3:-}" in
    "npm run test"|"npm run ci"|"npm test"*) return 0 ;;
    "npx playwright test"*) has_target "$@" && return 1; return 0 ;;
  esac
  return 1
}
if [ -z "${ADMIT_TOKEN:-}" ] && needs_slot "$@"; then
  exec bash scripts/admit.sh "quiet-test $*" -- bash "$0" "$@"
fi
case " $* " in
  *" --reporter"*) ;;
  *vitest*) ARGS+=(--reporter=dot) ;;
esac

# Idle watchdog. No limit is put on how long a run or a test may take. Progress is any of: the log
# grew, the run's processes used CPU, or the run is queued for a heavy-test lane. Only a run that
# shows none of these for IDLE_LIMIT_S seconds is treated as stuck: every node process in it
# writes a diagnostic report (build/test-reports/, JS stack and open handles), then the run is
# stopped. (A quiet typecheck on a busy machine prints nothing for minutes but burns CPU; a run
# waiting for a lane prints one line and then sleeps. Neither is stuck.)
IDLE_LIMIT_S="${OPENISD_IDLE_LIMIT_S:-180}"
# CPU time (clock ticks) used so far by the process and everything under it: one read of /proc and
# one awk per poll (cat tolerates processes that vanish mid-read).
tree_cpu_ticks() {
  cat /proc/[0-9]*/stat 2>/dev/null | awk -v root="$1" '
    { pid = $1; r = $0; sub(/^.*\) /, "", r); n = split(r, f, " ")
      if (n < 13) next
      ppid[pid] = f[2]; ticks[pid] = f[12] + f[13] }
    END { total = 0
      for (p in ticks) { q = p; d = 0
        while (q != "" && q != 0 && d++ < 200) { if (q == root) { total += ticks[p]; break } q = ppid[q] } }
      print total }'
}
node_descendants() {
  local parent="$1" child
  for child in $(pgrep -P "$parent"); do
    [ "$(ps -o comm= -p "$child")" = "node" ] && echo "$child"
    node_descendants "$child"
  done
}
source scripts/lib/progress.sh
source scripts/lib/ts-log.sh
export OPENISD_RUN_ID="${OPENISD_RUN_ID:-$$-$(date +%s)-$RANDOM}"
POLL_S="${QUIET_POLL_S:-5}"
BEAT_EVERY=$(( ${QUIET_HEARTBEAT_S:-30} / POLL_S ))
[ "$BEAT_EVERY" -ge 1 ] || BEAT_EVERY=1
BEAT=0
STARTED=$SECONDS
# The log carries START and END and a timestamp on every line (processes.md rule 8). The wrapper
# leads its own session (setsid): a stall or exit kill reaches the command and every child by session.
run_start "quiet-test" >"$LOG"
setsid bash scripts/lib/ts-log.sh "${ARGS[@]}" >>"$LOG" 2>&1 &
RUN_PID=$!
# Rule 2: any exit of this script stops the run's whole group.
kill_session() { pkill "-$1" -s "$RUN_PID" 2>/dev/null; }
trap 'kill_session TERM' EXIT
trap 'exit 143' INT TERM HUP
case " $* " in
  *" lint"*|*" typecheck"*|*" tsc "*|*" vue-tsc "*|*"/tsc "*|*"/vue-tsc "*|*" eslint "*|*"/eslint "*) IDLE_KILL=0 ;;
  *) IDLE_KILL=1 ;;
esac
LAST_SIZE=-1
LAST_CPU=-1
IDLE_S=0
STALLED=0
while kill -0 "$RUN_PID" 2>/dev/null; do
  sleep "$POLL_S"
  SIZE=$(stat -c %s "$LOG" 2>/dev/null || echo 0)
  CPU=$(tree_cpu_ticks "$RUN_PID")
  # Ticks are 100/s; more than 5 ticks in 5 s is a process doing work, not an idle one.
  if [ "$LAST_CPU" -ge 0 ] && [ $((CPU - LAST_CPU)) -gt 5 ]; then PROGRESS=1; else PROGRESS=0; fi
  tail -n 1 "$LOG" 2>/dev/null | grep -q "waiting up to" && PROGRESS=1
  [ "$SIZE" != "$LAST_SIZE" ] && PROGRESS=1
  LAST_SIZE="$SIZE"; LAST_CPU="$CPU"
  if [ "$PROGRESS" = "1" ]; then IDLE_S=0; else IDLE_S=$((IDLE_S + POLL_S)); fi
  BEAT=$((BEAT + 1))
  if [ "$BEAT" -ge "$BEAT_EVERY" ]; then
    BEAT=0
    if [ "$IDLE_S" -gt 0 ]; then echo "quiet-test: IDLE for $IDLE_S s (stalls at $IDLE_LIMIT_S s)" >&2
    else echo "quiet-test: working, elapsed $(progress_duration $((SECONDS - STARTED))), idle 0 s, log $((SIZE / 1024)) KB" >&2; fi
  fi
  # Lint and typecheck are deterministic tools: they never get an idle kill, however long they wait.
  if [ "$IDLE_S" -ge "$IDLE_LIMIT_S" ] && [ "$IDLE_KILL" = 1 ]; then
    STALLED=1
    for NODE_PID in $( [ "$(ps -o comm= -p "$RUN_PID")" = "node" ] && echo "$RUN_PID"; node_descendants "$RUN_PID"); do kill -USR2 "$NODE_PID" 2>/dev/null; done
    sleep 3
    kill_session TERM
    sleep 2
    kill_session KILL
    break
  fi
done
wait "$RUN_PID" 2>/dev/null
CODE=$?
if [ "$STALLED" = "1" ]; then
  echo "quiet-test: STALLED — no output, CPU use or queue wait for ${IDLE_LIMIT_S}s, run stopped. Node reports (JS stack, open handles): build/test-reports/" >>"$LOG"
  CODE=124
fi
run_end "quiet-test" "$CODE" >>"$LOG"
progress_end_line quiet-test "$CODE" $((SECONDS - STARTED)) >&2

# Passing-test traces: vitest verbose/list (✓ / √), playwright list (✓ N [project] ...),
# describe headers vitest prints under a passing file, and blank lines.
PASS_LINES='^[[:space:]]*(✓|√|✔)|^[[:space:]]*$|^(START quiet-test$|END quiet-test status=)'
# The log lines carry "<ts> <run id> " (rule 8); the shown output does not, the log keeps it.
TS_PREFIX='s/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z [^ ]+ //'

# strip ANSI colour first so the patterns match
sed -E "$TS_PREFIX" "$LOG" | sed -E 's/\x1b\[[0-9;]*[A-Za-z]//g' | grep -Ev "$PASS_LINES" > "$LOG.filtered"
TOTAL=$(wc -l < "$LOG.filtered")
head -n "$MAX" "$LOG.filtered"
# The summary is the log's tail. When the filtered output was shown whole it already ends with
# every non-pass line of that tail, so the tail is printed only when the cap cut it off.
if [ "$TOTAL" -gt "$MAX" ]; then
  echo "... $((TOTAL - MAX)) more non-pass lines; see $LOG.filtered"
  echo "--- last 15 lines of the log ---"
  sed -E "$TS_PREFIX" "$LOG" | sed -E 's/\x1b\[[0-9;]*[A-Za-z]//g' | tail -n 15
fi
echo "quiet-test: exit $CODE — full log $LOG"
exit "$CODE"
