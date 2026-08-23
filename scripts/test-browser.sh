#!/usr/bin/env bash
# Browser tests. Frees port 4100, then runs Playwright. Any extra args pass through:
#   bash scripts/test-browser.sh
#   bash scripts/test-browser.sh packages/ui/test/visual.browser.spec.js
#
# The kill CANNOT live in playwright.config.js's `webServer.command`: with
# `reuseExistingServer: false` Playwright probes the url BEFORE running that command and
# aborts with "http://localhost:4100 is already used" the moment anything answers — the
# command would never run and a kill inside it would never fire, so an orphaned server
# would fail the whole suite instead of being replaced. Freeing the port has to happen
# before Playwright is invoked at all, which is here.
#
# Taking the port is always correct: 4100 is Playwright's own (AGENTS.md "Port assignments"),
# never the human's 4000, and a server left on it serves stale code.
set -euo pipefail
# Must run in Git Bash on Windows (MSYSTEM set) or WSL (microsoft in /proc/version).
# PowerShell/cmd have no /proc, so they are still rejected.
{ [ -n "${MSYSTEM:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; } || { echo "ERROR: must run in Git Bash on Windows or WSL, not PowerShell/cmd" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup_chrome() {
  pkill -9 -f 'ms-playwright/chromium' 2>/dev/null || true
  pkill -9 -f 'chrome_crashpad_handler' 2>/dev/null || true
}
trap cleanup_chrome EXIT
cleanup_chrome

bash "$SCRIPT_DIR/kill-http.sh" 4100

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

# Run tests using the worker configuration from playwright.config.js
set +e
npx playwright test "$@"
STATUS=$?
set -e

if [ $STATUS -ne 0 ]; then
  echo ""
  echo "⚠️ Playwright suite interrupted/failed (exit code $STATUS). Retrying remaining/failed tests with --last-failed..." >&2
  bash "$SCRIPT_DIR/kill-http.sh" 4100
  set +e
  npx playwright test --last-failed "$@"
  STATUS=$?
  set -e
fi

if [ $STATUS -ne 0 ]; then
  echo ""
  echo "⚠️ Secondary retry failed (exit code $STATUS). Final fallback with --last-failed (workers=1)..." >&2
  bash "$SCRIPT_DIR/kill-http.sh" 4100
  npx playwright test --last-failed --workers=1 "$@"
  STATUS=$?
fi

exit $STATUS
