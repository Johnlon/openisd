#!/usr/bin/env bash
# Stop the dev server.
# Primary: kill the start-http.sh bash process via .server.pid (takes node children with it)
# Fallback: kill-http.sh port scan
set -euo pipefail
[ -z "${MSYSTEM:-}" ] && echo "ERROR: must run in Git Bash on Windows, not WSL or PowerShell" && exit 1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="$(dirname "$SCRIPT_DIR")/.server.pid"

if [ -f "$PID_FILE" ]; then
  pid=$(cat "$PID_FILE")
  echo "Killing start-http.sh PID $pid and its children..."
  kill -TERM "-$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || echo "PID $pid already gone"
  rm -f "$PID_FILE"
  sleep 1
fi

bash "$SCRIPT_DIR/kill-http.sh"
