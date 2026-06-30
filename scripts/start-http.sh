#!/usr/bin/env bash
# Start the dev server — runs all quality checks first, then serves on port 4000.
# This is the ONE script AI and developers should use. Never run npm run dev directly.
set -euo pipefail

PASS=0
FAIL=0
ERRORS=()

run() {
  local label="$1"; shift
  echo ""
  echo "── $label ──────────────────────────────────"
  if "$@"; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    ERRORS+=("$label")
  fi
}

echo "========================================"
echo "  Health checks — $(date '+%H:%M:%S')"
echo "========================================"

run "ESLint"       npm run lint
run "Unit tests"   node --test packages/engine/test/*.test.mjs packages/ui/test/config.test.mjs
run "Golden tests" node packages/engine/test/golden.test.mjs
run "DQ check"     python scripts/dq_check.py

echo ""
echo "========================================"
if [ "$FAIL" -gt 0 ]; then
  echo "  $FAIL check(s) FAILED — server not started:"
  for e in "${ERRORS[@]}"; do echo "    - $e"; done
  echo "========================================"
  exit 1
fi
echo "  All $PASS checks passed — starting server"
echo "========================================"

# Kill project port range and wait until port 4000 is confirmed free
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/kill-http.sh"

# Final confirmation that 4000 is truly free before Vite tries to bind
still=$(netstat -ano 2>/dev/null | awk "/:4000[[:space:]].*LISTENING/{print 1; exit}")
if [ -n "$still" ]; then
  echo "WARNING: port 4000 may still be occupied — starting anyway (will fail loudly if so)"
fi

echo ""
npm run dev -- --port 4000 --strictPort &
SERVER_PID=$!

echo "Waiting for server on http://localhost:4000/ ..."
for i in $(seq 1 45); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/ 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    echo "========================================"
    echo "  Server UP — http://localhost:4000/"
    echo "========================================"
    wait "$SERVER_PID"
    exit 0
  fi
  # Bail early if npm died
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "ERROR: dev server process exited unexpectedly"
    exit 1
  fi
  sleep 2
done

echo "ERROR: server did not respond on port 4000 after 90s"
kill "$SERVER_PID" 2>/dev/null || true
exit 1
