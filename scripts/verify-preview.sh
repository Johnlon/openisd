#!/usr/bin/env bash
# Verify that the preview server on port 4000 is running the latest built assets.
set -euo pipefail

# Environment guard
{ [ -n "${MSYSTEM:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; } || { echo "ERROR: must run in Git Bash on Windows or WSL, not PowerShell/cmd" >&2; exit 1; }

echo "Verifying that http://localhost:4000/ is running the latest software, and that it works..."

# 1. Check HTTP response code
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/ || echo "000")
if [ "$HTTP_STATUS" -ne 200 ]; then
  echo "ERROR: Server on port 4000 is not responding with HTTP 200 (status code: $HTTP_STATUS)." >&2
  exit 1
fi

# 2. Find the built JS asset file in dist/assets
if ! ls packages/ui/dist/assets/index-*.js >/dev/null 2>&1; then
  echo "ERROR: No built JS asset found in packages/ui/dist/assets/." >&2
  exit 1
fi

BUILT_JS=$(ls -t packages/ui/dist/assets/index-*.js | head -n 1 | xargs basename)

# 3. Extract the served JS asset from http://localhost:4000/
HTML_CONTENT=$(curl -s http://localhost:4000/)
SERVED_JS=$(echo "$HTML_CONTENT" | grep -o 'assets/index-[a-zA-Z0-9_-]\+\.js' | head -n 1 | sed 's|assets/||' || true)

if [ -z "$SERVED_JS" ]; then
  echo "ERROR: Could not find any index-*.js asset link in the served index.html on port 4000." >&2
  exit 1
fi

if [ "$SERVED_JS" != "$BUILT_JS" ]; then
  echo "ERROR: Stale preview server! Port 4000 is serving '$SERVED_JS' but the latest built file is '$BUILT_JS'." >&2
  echo "Please rebuild the application or restart the preview server using 'bash scripts/preview-4000.sh'." >&2
  exit 1
fi

echo "Assets are current ($BUILT_JS). Now checking that the app actually RUNS..."

# 4. Load it in a real browser and fail on any uncaught exception or console error.
#
# Steps 1-3 compare FILENAMES. They prove the served bytes are CURRENT; they cannot prove they
# are CORRECT, and they certified a build whose every driver-panel computation threw on load
# (bugs/BUG_20260817_deploy_verifies_asset_freshness_but_never_that_the_app_runs.md). HTTP 200
# is the SERVER answering, not the app working.
node "$(dirname "$0")/verify-app-runs.mjs" http://localhost:4000/

echo "SUCCESS: Preview server on port 4000 is serving the latest build ($BUILT_JS), and it runs."
exit 0
