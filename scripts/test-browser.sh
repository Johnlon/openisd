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
{ [ -n "${MSYSTEM:-}" ] || [ "$(uname -s)" = Linux ]; } || { echo "ERROR: must run in Git Bash on Windows, WSL or Linux, not PowerShell/cmd" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Re-exec into our own process group/session. This is what makes the cleanup trap below able to
# kill EXACTLY this run's descendants (playwright, vite, chromium and its zygote/GPU/renderer
# children) via `kill -- -$$`, and nothing else — no other run's processes, no other agent's.
# Without this, `$$` may be a process group shared with (or a subset of) whatever invoked this
# script, and a group-kill would either miss descendants or hit unrelated processes.
if [ -z "${OPENISD_IN_OWN_GROUP:-}" ]; then
  export OPENISD_IN_OWN_GROUP=1
  # The run this one belongs to, recorded before setsid takes it out of its caller's group: the
  # housekeeper stops it when that owner is gone (scripts/browser-runs.sh). post-land/run.sh sets its own.
  [ -n "${OPENISD_BROWSER_OWNER:-}" ] \
    || export OPENISD_BROWSER_OWNER="$PPID $(awk '{print $22}' "/proc/$PPID/stat" 2> /dev/null)"
  # The run starts in a new session as a background child (setsid execs in place, so $! is the
  # session and group leader). Any exit or TERM/INT/HUP of this wrapper stops that whole group:
  # TERM, a short grace, KILL, then reap. A bare `exec setsid --wait` forwarded nothing, so a
  # killed wrapper left playwright, vite and chrome running.
  setsid bash "$0" "$@" &
  RUN_LEADER=$!
  stop_run() {
    trap '' TERM INT HUP
    if kill -0 -- "-$RUN_LEADER" 2>/dev/null; then
      kill -TERM -- "-$RUN_LEADER" 2>/dev/null
      sleep 1
      kill -KILL -- "-$RUN_LEADER" 2>/dev/null
    fi
    wait "$RUN_LEADER" 2>/dev/null
  }
  trap 'stop_run; exit 143' TERM
  trap 'stop_run; exit 130' INT
  trap 'stop_run; exit 129' HUP
  trap 'stop_run' EXIT
  wait "$RUN_LEADER"
  RUN_STATUS=$?
  trap - EXIT
  stop_run
  exit "$RUN_STATUS"
fi

# shellcheck source=./test-concurrency.sh
source "$SCRIPT_DIR/lib/ts-log.sh"
export OPENISD_RUN_ID="${OPENISD_RUN_ID:-$$-$(date +%s)-$RANDOM}"
source "$SCRIPT_DIR/test-concurrency.sh"
reserve_test_slot || exit 1   # sets OPENISD_TEST_WORKERS, OPENISD_TEST_PORT — see that file for why this
                     # is a locked critical section rather than each run reading memory alone.

# Every process in this run's group EXCEPT this shell. After the setsid re-exec above, $$ is
# the group id, so the group is exactly this run's descendants. This shell must be excluded:
# a group-wide `kill -- -$$` also SIGKILLs the shell itself, so `setsid --wait` reports
# "child did not exit normally" and the wrapper exits 9 on a fully green suite — which is a
# refused push, since the pre-push hook runs the browser gate through here.
group_others() {
  pgrep -g "$$" | grep -vx "$$" || true
}

cleanup() {
  local status=$?
  release_test_slot
  # Ignore TERM in THIS shell so a descendant re-signalling the group can't cut this trap off
  # before the follow-up KILL runs.
  trap '' TERM
  local others
  others=$(group_others)
  [ -n "$others" ] && kill -TERM $others 2>/dev/null || true
  sleep 0.3
  others=$(group_others)
  [ -n "$others" ] && kill -KILL $others 2>/dev/null || true
  exit "$status"
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

set +e
run_start "browser-test"
npx playwright test "$@"
STATUS=$?
set -e
run_end "browser-test" "$STATUS"

exit $STATUS
