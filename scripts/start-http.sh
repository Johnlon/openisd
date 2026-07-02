#!/usr/bin/env bash
# Start the dev server on the given port (default: 4000).
# Runs all quality checks first, then serves with Vite dev.
# Usage: bash scripts/start-http.sh [port]
#   4000 = human's preview/dev server (default)
#   4200 = agent-started dev server
set -euo pipefail
[ -z "${MSYSTEM:-}" ] && echo "ERROR: must run in Git Bash on Windows, not WSL or PowerShell" && exit 1

PORT=${1:-4000}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="$ROOT_DIR/.server-${PORT}.pid"
LOG_FILE="$ROOT_DIR/.server-${PORT}.log"

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
run "Type check"   npm run typecheck
run "Unit tests"   npm run test:unit
run "DQ check"     python scripts/dq_check.py

echo ""
echo "========================================"
if [ "$FAIL" -gt 0 ]; then
  echo "  $FAIL check(s) FAILED — server not started:"
  for e in "${ERRORS[@]}"; do echo "    - $e"; done
  echo "========================================"
  exit 1
fi
echo "  All $PASS checks passed — starting server on port $PORT"
echo "========================================"

# If a Vite dev server is already up on this port, reuse it
if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/@vite/client" 2>/dev/null | grep -q "200"; then
  echo "========================================"
  echo "  Server already UP — http://localhost:${PORT}/"
  echo "========================================"
  exit 0
fi

# Kill the specific port and wait until it is confirmed free
bash "$SCRIPT_DIR/kill-http.sh" "$PORT"

echo ""
echo "Starting server (log → .server-${PORT}.log, PID → .server-${PORT}.pid)"
nohup npm run dev -- --port "$PORT" --strictPort --host > "$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"
echo "PID: $SERVER_PID"

echo "Waiting for server on http://localhost:${PORT}/ ..."
for i in $(seq 1 45); do
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/@vite/client" 2>/dev/null | grep -q "200"; then
    echo "========================================"
    echo "  Server UP — http://localhost:${PORT}/  (PID $SERVER_PID)"
    echo "========================================"
    exit 0
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "ERROR: dev server process exited unexpectedly — check .server-${PORT}.log"
    exit 1
  fi
  echo "  waiting... ($i/45)"
  sleep 2
done

echo "ERROR: server did not respond on port ${PORT} after 90s — check .server-${PORT}.log"
kill "$SERVER_PID" 2>/dev/null || true
rm -f "$PID_FILE"
exit 1
