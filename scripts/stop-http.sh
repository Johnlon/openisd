#!/usr/bin/env bash
# Stop the dev server on the given port (default: 4000).
# Primary: kill via the PID file written by start-http.sh.
# Fallback: kill-http.sh port scan.
# Usage: bash scripts/stop-http.sh [port]
set -euo pipefail
# Must run in Git Bash on Windows (MSYSTEM set) or WSL (microsoft in /proc/version).
# PowerShell/cmd have no /proc, so they are still rejected.
{ [ -n "${MSYSTEM:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; } || { echo "ERROR: must run in Git Bash on Windows or WSL, not PowerShell/cmd" >&2; exit 1; }

PORT=${1:-4000}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
PID_FILE="$ROOT_DIR/.server-${PORT}.pid"

if [ -f "$PID_FILE" ]; then
  pid=$(cat "$PID_FILE")
  echo "Killing server PID $pid (port $PORT) and its children..."
  kill -TERM "-$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || echo "PID $pid already gone"
  rm -f "$PID_FILE"
  sleep 1
fi

bash "$SCRIPT_DIR/kill-http.sh" "$PORT"
