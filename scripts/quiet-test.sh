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
LOG_DIR="build/test-logs"
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
case " $* " in
  *vitest*)
    if [ "${OPENISD_FULL_GATE:-}" != "1" ] && ! printf '%s\n' "$@" | grep -qE '\.(test|spec)\.(ts|js|mjs)$|/test/'; then
      echo "quiet-test: a vitest run names its target specs; the full suite runs only in the pre-commit hook and scripts/health-check.sh (.claude/rules/verify.md)." >&2
      exit 1
    fi
    ;;
esac
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
# CPU time (clock ticks) used so far by the process and everything under it.
tree_cpu_ticks() {
  local pid="$1" child total=0 fields
  if fields=$(cut -d')' -f2- "/proc/$pid/stat" 2>/dev/null); then
    set -- $fields
    total=$(( ${12:-0} + ${13:-0} ))
  fi
  for child in $(pgrep -P "$pid"); do total=$(( total + $(tree_cpu_ticks "$child") )); done
  echo "$total"
}
node_descendants() {
  local parent="$1" child
  for child in $(pgrep -P "$parent"); do
    [ "$(ps -o comm= -p "$child")" = "node" ] && echo "$child"
    node_descendants "$child"
  done
}
"${ARGS[@]}" >"$LOG" 2>&1 &
RUN_PID=$!
LAST_SIZE=-1
LAST_CPU=-1
IDLE_S=0
STALLED=0
while kill -0 "$RUN_PID" 2>/dev/null; do
  sleep 5
  SIZE=$(stat -c %s "$LOG" 2>/dev/null || echo 0)
  CPU=$(tree_cpu_ticks "$RUN_PID")
  # Ticks are 100/s; more than 5 ticks in 5 s is a process doing work, not an idle one.
  if [ "$LAST_CPU" -ge 0 ] && [ $((CPU - LAST_CPU)) -gt 5 ]; then PROGRESS=1; else PROGRESS=0; fi
  tail -n 1 "$LOG" 2>/dev/null | grep -q "waiting up to" && PROGRESS=1
  [ "$SIZE" != "$LAST_SIZE" ] && PROGRESS=1
  LAST_SIZE="$SIZE"; LAST_CPU="$CPU"
  if [ "$PROGRESS" = "1" ]; then IDLE_S=0; else IDLE_S=$((IDLE_S + 5)); fi
  if [ "$IDLE_S" -ge "$IDLE_LIMIT_S" ]; then
    STALLED=1
    for NODE_PID in $( [ "$(ps -o comm= -p "$RUN_PID")" = "node" ] && echo "$RUN_PID"; node_descendants "$RUN_PID"); do kill -USR2 "$NODE_PID" 2>/dev/null; done
    sleep 3
    pkill -TERM -P "$RUN_PID" 2>/dev/null
    kill -TERM "$RUN_PID" 2>/dev/null
    break
  fi
done
wait "$RUN_PID" 2>/dev/null
CODE=$?
if [ "$STALLED" = "1" ]; then
  echo "quiet-test: STALLED — no output, CPU use or queue wait for ${IDLE_LIMIT_S}s, run stopped. Node reports (JS stack, open handles): build/test-reports/" >>"$LOG"
  CODE=124
fi

# Passing-test traces: vitest verbose/list (✓ / √), playwright list (✓ N [project] ...),
# describe headers vitest prints under a passing file, and blank lines.
PASS_LINES='^[[:space:]]*(✓|√|✔)|^[[:space:]]*$'

# strip ANSI colour first so the patterns match
sed -E 's/\x1b\[[0-9;]*[A-Za-z]//g' "$LOG" | grep -Ev "$PASS_LINES" > "$LOG.filtered"
TOTAL=$(wc -l < "$LOG.filtered")
head -n "$MAX" "$LOG.filtered"
# The summary is the log's tail. When the filtered output was shown whole it already ends with
# every non-pass line of that tail, so the tail is printed only when the cap cut it off.
if [ "$TOTAL" -gt "$MAX" ]; then
  echo "... $((TOTAL - MAX)) more non-pass lines; see $LOG.filtered"
  echo "--- last 15 lines of the log ---"
  sed -E 's/\x1b\[[0-9;]*[A-Za-z]//g' "$LOG" | tail -n 15
fi
echo "quiet-test: exit $CODE — full log $LOG"
exit "$CODE"
