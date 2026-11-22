#!/usr/bin/env bash
# Stop the dev server on the given port (default: 4000).
# Primary: kill the server group recorded in the PID file written by start-http.sh.
# Fallback: kill-http.sh port scan.
# Usage: bash scripts/stop-http.sh [port]
set -euo pipefail
# Must run in Git Bash on Windows (MSYSTEM set) or WSL (microsoft in /proc/version).
# PowerShell/cmd have no /proc, so they are still rejected.
{ [ -n "${MSYSTEM:-}" ] || [ "$(uname -s)" = Linux ]; } || { echo "ERROR: must run in Git Bash on Windows, WSL or Linux, not PowerShell/cmd" >&2; exit 1; }

PORT=${1:-4000}
[ "$PORT" != 4000 ] || { echo "ERROR: port 4000 is the openisd-preview unit; use bash scripts/preview-4000.sh (systemctl --user stop openisd-preview to stop it)" >&2; exit 1; }
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="${HTTP_STATE_DIR:-$ROOT_DIR}/.server-${PORT}.pid"

if [ -f "$PID_FILE" ]; then
  pid=$(cat "$PID_FILE")
  echo "Killing server PID $pid (port $PORT) and its children..."
  # start-http.sh runs the server as its own session leader: the pid file holds the group id.
  kill -TERM -- "-$pid" 2>/dev/null || echo "group $pid already gone"
  rm -f "$PID_FILE"
  sleep 1
fi

bash "$SCRIPT_DIR/kill-http.sh" "$PORT"
