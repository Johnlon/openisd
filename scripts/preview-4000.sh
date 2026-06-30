#!/usr/bin/env bash
# Start the Vite preview server on port 4000.
# Kills the project port range first to guarantee a clean start.
set -euo pipefail
[ -z "${MSYSTEM:-}" ] && echo "ERROR: must run in Git Bash on Windows, not WSL or PowerShell" && exit 1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "$SCRIPT_DIR/kill-http.sh" 4000
sleep 2
npm run preview -- --port 4000 --strictPort
