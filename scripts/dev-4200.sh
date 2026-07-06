#!/usr/bin/env bash
# Start the agent's vite dev server on port 4200.
# Runs all health checks (lint, unit, golden, DQ), then starts Vite dev.
# Use stop-http.sh 4200 to stop it.
set -euo pipefail
# Must run in Git Bash on Windows (MSYSTEM set) or WSL (microsoft in /proc/version).
# PowerShell/cmd have no /proc, so they are still rejected.
{ [ -n "${MSYSTEM:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; } || { echo "ERROR: must run in Git Bash on Windows or WSL, not PowerShell/cmd" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/start-http.sh" 4200

# On WSL, also print the interface IP so the app is reachable from Windows (a browser on
# the Windows host, or another device on the LAN). Vite binds with --host, so it listens
# on all interfaces. On Git Bash (native Windows) there is no separate WSL IP, so skip.
if grep -qi microsoft /proc/version 2>/dev/null; then
  WSL_IP="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}')"
  [ -z "$WSL_IP" ] && WSL_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  if [ -n "$WSL_IP" ]; then
    echo "========================================"
    echo "  From Windows / LAN:  http://${WSL_IP}:4200/"
    echo "  (http://localhost:4200/ also works via WSL2 localhost forwarding)"
    echo "========================================"
  fi
fi
