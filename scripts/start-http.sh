#!/usr/bin/env bash
# Start an agent's Vite dev server on the given port (default 4200). It runs no lint, typecheck or tests.
# Port 4000 is the openisd-preview systemd unit: use scripts/preview-4000.sh for it.
# Usage: bash scripts/start-http.sh [port]
# The server is its own session and process group; its pid (= its group id) is in $HTTP_STATE_DIR/.server-<port>.pid
# (default: the repo root). If this script dies before the server is ready, the group is killed. Env START_HTTP_CMD
# replaces the server command (tests).
set -euo pipefail
# Must run in Git Bash on Windows (MSYSTEM set) or WSL (microsoft in /proc/version).
# PowerShell/cmd have no /proc, so they are still rejected.
{ [ -n "${MSYSTEM:-}" ] || [ "$(uname -s)" = Linux ]; } || { echo "ERROR: must run in Git Bash on Windows, WSL or Linux, not PowerShell/cmd" >&2; exit 1; }

PORT=${1:-4200}
[ "$PORT" != 4000 ] || { echo "ERROR: port 4000 is the openisd-preview unit; use bash scripts/preview-4000.sh" >&2; exit 1; }
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
STATE_DIR="${HTTP_STATE_DIR:-$ROOT_DIR}"
PID_FILE="$STATE_DIR/.server-${PORT}.pid"
LOG_FILE="$STATE_DIR/.server-${PORT}.log"
SERVER_CMD="${START_HTTP_CMD:-npm run dev -- --port $PORT --strictPort --host}"

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
echo "Starting server (log → $LOG_FILE, group → $PID_FILE)"
READY=0
SERVER_PID=""
stop_unready() { # a server that never became ready is not left behind, with its children
  [ "$READY" = 1 ] && return 0
  [ -n "$SERVER_PID" ] || SERVER_PID=$(cat "$PID_FILE" 2>/dev/null || true)   # killed before the pid was read back
  [ -z "$SERVER_PID" ] || kill -TERM -- "-$SERVER_PID" 2>/dev/null || true
  rm -f "$PID_FILE"
}
trap stop_unready EXIT
trap 'exit 143' INT TERM HUP
cd "$ROOT_DIR"
# setsid makes the shell the session and group leader, so its pid is the group id.
setsid bash -c 'echo $$ > "$1"; exec bash -c "$2"' _ "$PID_FILE" "$SERVER_CMD" > "$LOG_FILE" 2>&1 < /dev/null &
for _ in 1 2 3 4 5 6 7 8 9 10; do [ -s "$PID_FILE" ] && break; sleep 0.1; done
SERVER_PID=$(cat "$PID_FILE" 2>/dev/null || true)
[ -n "$SERVER_PID" ] || { echo "ERROR: server did not start — check $LOG_FILE"; exit 1; }
echo "PID/group: $SERVER_PID"

echo "Waiting for server on http://localhost:${PORT}/ ..."
for i in $(seq 1 45); do
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/@vite/client" 2>/dev/null | grep -q "200"; then
    READY=1
    echo "========================================"
    echo "  Server UP — http://localhost:${PORT}/  (group $SERVER_PID)"
    echo "========================================"
    exit 0
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "ERROR: dev server process exited unexpectedly — check $LOG_FILE"
    exit 1
  fi
  echo "  waiting... ($i/45)"
  sleep 2
done

echo "ERROR: server did not respond on port ${PORT} after 90s — check $LOG_FILE"
exit 1
