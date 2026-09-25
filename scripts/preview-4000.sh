#!/usr/bin/env bash
# Start the canonical live Vite development server on port 4000 with HMR.
# Source edits are served immediately. This script must never be changed to `vite preview`.
set -euo pipefail
# Must run in Git Bash on Windows (MSYSTEM set) or WSL (microsoft in /proc/version).
# PowerShell/cmd have no /proc, so they are still rejected.
{ [ -n "${MSYSTEM:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; } || { echo "ERROR: must run in Git Bash on Windows or WSL, not PowerShell/cmd" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "$SCRIPT_DIR/kill-http.sh" 4000
sleep 2
npx vite --host 0.0.0.0 --port 4000 --strictPort
