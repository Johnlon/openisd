#!/usr/bin/env bash
# Run all project health checks: lint, unit tests, golden tests, browser tests.
# Exit code 0 = all passed. Non-zero = something failed.
# Add new checks here as they are created — this is the single entry point.
# Scraper/DQ checks live in the sibling winisd_tools repo, not here.
set -euo pipefail
# Must run in Git Bash on Windows (MSYSTEM set) or WSL (microsoft in /proc/version).
# PowerShell/cmd have no /proc, so they are still rejected.
{ [ -n "${MSYSTEM:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; } || { echo "ERROR: must run in Git Bash on Windows or WSL, not PowerShell/cmd" >&2; exit 1; }

PASS=0
FAIL=0
ERRORS=()

run() {
  local label="$1"; shift
  echo ""
  echo "── $label ──────────────────────────────────"
  if "$@"; then
    echo "  PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label"
    FAIL=$((FAIL + 1))
    ERRORS+=("$label")
  fi
}

echo "========================================"
echo "  OpenISD health check"
echo "  $(date '+%H:%M:%S')"
echo "========================================"

run "ESLint"            npm run lint
run "Type check"        npm run typecheck
run "Unit tests"        npm run test:unit
# Free Playwright's port 4100 first: with reuseExistingServer:false, Playwright errors out
# ("4100 is already used") on a stale server BEFORE it runs its own kill in webServer.command.
# Self-heal here so a leftover run never fails the gate — no human/AI intervention needed.
bash scripts/kill-http.sh 4100 >/dev/null 2>&1 || true
run "Browser tests"     npx playwright test

echo ""
echo "========================================"
if [ "$FAIL" -eq 0 ]; then
  echo "  ALL $PASS checks passed"
else
  echo "  $PASS passed, $FAIL FAILED:"
  for e in "${ERRORS[@]}"; do echo "    - $e"; done
fi
echo "  $(date '+%H:%M:%S')"
echo "========================================"

[ "$FAIL" -eq 0 ]
