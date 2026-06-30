#!/usr/bin/env bash
# Start the dev server — runs all quality checks first, then serves on port 4000.
# This is the ONE script AI and developers should use. Never run npm run dev directly.
set -euo pipefail
[ -z "${MSYSTEM:-}" ] && echo "ERROR: must run in Git Bash on Windows, not WSL or PowerShell" && exit 1

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

# If a Vite dev server is already up on 4000, reuse it — don't kill and restart
if curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/@vite/client 2>/dev/null | grep -q "200"; then
  echo "========================================"
  echo "  Server already UP — http://localhost:4000/"
  echo "========================================"
  exit 0
fi

# Kill project port range and wait until port 4000 is confirmed free
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/kill-http.sh"

PID_FILE="$(pwd)/.server.pid"
LOG_FILE="$(pwd)/.server.log"

echo ""
echo "Starting server (log → .server.log, PID → .server.pid)"
nohup npm run dev -- --port 4000 --strictPort > "$LOG_FILE" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$PID_FILE"
echo "PID: $SERVER_PID"

echo "Waiting for server on http://localhost:4000/ ..."
for i in $(seq 1 45); do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/@vite/client 2>/dev/null | grep -q "200"; then
    echo "========================================"
    echo "  Server UP — http://localhost:4000/  (PID $SERVER_PID)"
    echo "========================================"
    exit 0
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "ERROR: dev server process exited unexpectedly — check .server.log"
    exit 1
  fi
  echo "  waiting... ($i/45)"
  sleep 2
done

echo "ERROR: server did not respond on port 4000 after 90s — check .server.log"
kill "$SERVER_PID" 2>/dev/null || true
rm -f "$PID_FILE"
exit 1
