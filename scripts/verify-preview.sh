#!/usr/bin/env bash
# Verify that the live Vite development server on port 4000 is serving the working tree.
set -euo pipefail

# Environment guard
{ [ -n "${MSYSTEM:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; } || { echo "ERROR: must run in Git Bash on Windows or WSL, not PowerShell/cmd" >&2; exit 1; }

echo "Verifying that http://localhost:4000/ is the live Vite app, and that it works..."

# 1. Check HTTP response code
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/ || echo "000")
if [ "$HTTP_STATUS" -ne 200 ]; then
  echo "ERROR: Server on port 4000 is not responding with HTTP 200 (status code: $HTTP_STATUS)." >&2
  exit 1
fi

# 2. The live app must expose Vite's development client. A static dist server is wrong here.
VITE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/@vite/client || echo "000")
if [ "$VITE_STATUS" -ne 200 ]; then
  echo "ERROR: Port 4000 is not serving the Vite development client (status: $VITE_STATUS)." >&2
  echo "Start it with: bash scripts/preview-4000.sh" >&2
  exit 1
fi

# 3. Confirm the HTML is the development document, not a production asset manifest.
HTML_CONTENT=$(curl -s http://localhost:4000/)
if ! printf '%s' "$HTML_CONTENT" | grep -q '/@vite/client'; then
  echo "ERROR: Port 4000 returned HTML without Vite's live client." >&2
  exit 1
fi

echo "Vite development server is live. Now checking that the app actually RUNS..."

# 4. Load it in a real browser and fail on any uncaught exception or console error.
#
# Steps 1-3 compare FILENAMES. They prove the served bytes are CURRENT; they cannot prove they
# are CORRECT, and they certified a build whose every driver-panel computation threw on load
# (bugs/BUG_20260817_deploy_verifies_asset_freshness_but_never_that_the_app_runs.md). HTTP 200
# is the SERVER answering, not the app working.
node "$(dirname "$0")/verify-app-runs.mjs" http://localhost:4000/

echo "SUCCESS: Port 4000 is serving the live working tree, and the app runs."
exit 0
