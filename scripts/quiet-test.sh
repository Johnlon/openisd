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

# Idle watchdog. No limit is put on how long a run or a test may take: a run that keeps writing
# output is making progress and is left alone. Only a run whose log has not grown for IDLE_LIMIT_S
# seconds is treated as stuck: every node process in it writes a diagnostic report
# (build/test-reports/, JS stack and open handles), then the run is stopped.
IDLE_LIMIT_S="${OPENISD_IDLE_LIMIT_S:-180}"
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
IDLE_S=0
STALLED=0
while kill -0 "$RUN_PID" 2>/dev/null; do
  sleep 5
  SIZE=$(stat -c %s "$LOG" 2>/dev/null || echo 0)
  if [ "$SIZE" = "$LAST_SIZE" ]; then IDLE_S=$((IDLE_S + 5)); else IDLE_S=0; LAST_SIZE="$SIZE"; fi
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
  echo "quiet-test: STALLED — no output for ${IDLE_LIMIT_S}s, run stopped. Node reports (JS stack, open handles): build/test-reports/" >>"$LOG"
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
