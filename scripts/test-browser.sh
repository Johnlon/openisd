#!/usr/bin/env bash
# Browser tests. Frees port 4100, then runs Playwright. Any extra args pass through:
#   bash scripts/test-browser.sh
#   bash scripts/test-browser.sh packages/ui/test/visual.browser.spec.js
#
# The kill CANNOT live in playwright.config.js's `webServer.command`, which is where it
# used to sit. With `reuseExistingServer: false` Playwright probes the url BEFORE running
# that command and aborts with "http://localhost:4100 is already used" the moment anything
# answers — so the command never runs and the kill inside it never fires. An orphaned
# server from a previous run therefore failed the whole suite instead of being replaced.
# Freeing the port has to happen before Playwright is invoked at all, which is here.
#
# Taking the port is always correct: 4100 is Playwright's own (AGENTS.md "Port assignments"),
# never the human's 4000, and a server left on it serves stale code.
set -euo pipefail
# Must run in Git Bash on Windows (MSYSTEM set) or WSL (microsoft in /proc/version).
# PowerShell/cmd have no /proc, so they are still rejected.
{ [ -n "${MSYSTEM:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; } || { echo "ERROR: must run in Git Bash on Windows or WSL, not PowerShell/cmd" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/kill-http.sh" 4100
exec npx playwright test "$@"
