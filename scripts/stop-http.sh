#!/usr/bin/env bash
# Stop the dev server — kills all processes on the project port range (4000-4005).
set -euo pipefail
[ -z "${MSYSTEM:-}" ] && echo "ERROR: must run in Git Bash on Windows, not WSL or PowerShell" && exit 1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/kill-http.sh"
