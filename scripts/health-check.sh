#!/usr/bin/env bash
# Run all project health checks: lint, unit tests, golden tests, browser tests, DQ, scraper tests.
# Exit code 0 = all passed. Non-zero = something failed.
# Add new checks here as they are created — this is the single entry point.
set -euo pipefail
# Must run in Git Bash on Windows (MSYSTEM set) or WSL (microsoft in /proc/version).
# PowerShell/cmd have no /proc, so they are still rejected.
{ [ -n "${MSYSTEM:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; } || { echo "ERROR: must run in Git Bash on Windows or WSL, not PowerShell/cmd" >&2; exit 1; }

# Windows Git Bash exposes `python`; WSL/Ubuntu exposes `python3`. Resolve whichever exists.
PYTHON="$(command -v python || command -v python3)"

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
run "Browser tests"     npx playwright test
run "DQ check"          "$PYTHON" scripts/dq_check.py
run "Scraper tests"     "$PYTHON" -m pytest scripts/scrapers/ -v --tb=short

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
