#!/usr/bin/env bash
# Browser tests. Frees its assigned port, then runs Playwright. Any extra args pass through:
#   bash scripts/test-browser.sh
#   bash scripts/test-browser.sh packages/ui/test/visual.browser.spec.js
#
# The kill CANNOT live in playwright.config.js's `webServer.command`: with
# `reuseExistingServer: false` Playwright probes the url BEFORE running that command and
# aborts with "http://localhost:PORT is already used" the moment anything answers — the
# command would never run and a kill inside it would never fire, so an orphaned server
# would fail the whole suite instead of being replaced. Freeing the port has to happen
# before Playwright is invoked at all, which is here.
set -euo pipefail
# Must run in Git Bash on Windows (MSYSTEM set) or WSL (microsoft in /proc/version).
# PowerShell/cmd have no /proc, so they are still rejected.
{ [ -n "${MSYSTEM:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; } || { echo "ERROR: must run in Git Bash on Windows or WSL, not PowerShell/cmd" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Re-exec into our own process group/session. This is what makes the cleanup trap below able to
# kill EXACTLY this run's descendants (playwright, vite, chromium and its zygote/GPU/renderer
# children) via `kill -- -$$`, and nothing else — no other run's processes, no other agent's.
# Without this, `$$` may be a process group shared with (or a subset of) whatever invoked this
# script, and a group-kill would either miss descendants or hit unrelated processes.
if [ -z "${OPENISD_IN_OWN_GROUP:-}" ]; then
  export OPENISD_IN_OWN_GROUP=1
  exec setsid --fork --wait bash "$0" "$@"
fi

# shellcheck source=./test-concurrency.sh
source "$SCRIPT_DIR/test-concurrency.sh"
reserve_test_slot   # sets OPENISD_TEST_WORKERS, OPENISD_TEST_PORT — see that file for why this
                     # is a locked critical section rather than each run reading memory alone.

cleanup() {
  release_test_slot
  # Ignore TERM in THIS shell so the group-wide signal below doesn't cut this trap off before
  # the follow-up KILL runs; SIGKILL can't be ignored, so that one still ends this shell too,
  # but only as the very last thing this trap does.
  trap '' TERM
  kill -TERM -- -$$ 2>/dev/null || true
  sleep 0.3
  kill -KILL -- -$$ 2>/dev/null || true
}
trap cleanup EXIT

bash "$SCRIPT_DIR/kill-http.sh" "$OPENISD_TEST_PORT"

# A run that EXECUTES NOTHING must never report success. Playwright's own default is to fail
# on an empty suite (the opt-out is `--pass-with-no-tests`; there is no `--fail-on-empty`),
# but a stale path reaches that default only after the two --last-failed retries below have
# each printed their own "interrupted/failed" banner, which reads as an infrastructure wobble
# rather than "this gate matches no files any more". Collect first and refuse up front, naming
# the args, so a gate pointing at a moved spec is unmistakable.
set +e
LIST_OUT="$(npx playwright test --list "$@" 2>&1)"
set -e
if ! printf '%s' "$LIST_OUT" | grep -qE '^Total: [1-9][0-9]* test'; then
  printf '%s\n' "$LIST_OUT" >&2
  echo "" >&2
  echo "ERROR: zero tests matched — a gate that runs nothing must not pass. Args: ${*:-<none>}" >&2
  exit 1
fi

run_with_watchdog() {
  local port="$1"
  shift

  # Run playwright in the background to capture its exact PID
  set +e
  npx playwright test "$@" &
  local test_pid=$!
  set -e

  # Start the watchdog in the background
  (
    sleep 15
    local failures=0
    while true; do
      if ! curl -s -f -m 2 -o /dev/null "http://localhost:$port"; then
        failures=$((failures + 1))
        if [ "$failures" -ge 3 ]; then
          echo "" >&2
          echo "🚨 WATCHDOG: Vite server on port $port is unreachable. Aborting Playwright run early!" >&2
          kill -TERM "$test_pid" 2>/dev/null || true
          break
        fi
      else
        failures=0
      fi
      sleep 5
      # Exit if playwright is no longer running
      if ! kill -0 "$test_pid" 2>/dev/null; then
        break
      fi
    done
  ) &
  local watchdog_pid=$!

  # Wait for playwright to finish (or be killed by watchdog)
  set +e
  wait "$test_pid"
  local status=$?
  set -e

  # Kill the watchdog now that the run is over
  kill "$watchdog_pid" 2>/dev/null || true
  wait "$watchdog_pid" 2>/dev/null || true

  return $status
}

run_with_watchdog "$OPENISD_TEST_PORT" "$@"
STATUS=$?

if [ $STATUS -ne 0 ]; then
  echo ""
  echo "⚠️ Playwright suite interrupted/failed (exit code $STATUS). Retrying remaining/failed tests with --last-failed..." >&2
  bash "$SCRIPT_DIR/kill-http.sh" "$OPENISD_TEST_PORT"
  run_with_watchdog "$OPENISD_TEST_PORT" --last-failed "$@"
  STATUS=$?
fi

if [ $STATUS -ne 0 ]; then
  echo ""
  echo "⚠️ Secondary retry failed (exit code $STATUS). Final fallback with --last-failed (workers=1)..." >&2
  bash "$SCRIPT_DIR/kill-http.sh" "$OPENISD_TEST_PORT"
  run_with_watchdog "$OPENISD_TEST_PORT" --last-failed --workers=1 "$@"
  STATUS=$?
fi

exit $STATUS
