#!/usr/bin/env bash
# Start the Vite preview server on port 4000.
# Kills the project port range first to guarantee a clean start.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "$SCRIPT_DIR/kill-http.sh"
sleep 2
npm run preview -- --port 4000 --strictPort
