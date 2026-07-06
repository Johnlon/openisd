#!/usr/bin/env bash
# Build the production dist for GitHub Pages deployment.
# Output goes to packages/ui/dist/ — published to gh-pages by .github/workflows/deploy.yml.
set -euo pipefail
# Must run in Git Bash on Windows (MSYSTEM set) or WSL (microsoft in /proc/version).
# PowerShell/cmd have no /proc, so they are still rejected.
{ [ -n "${MSYSTEM:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; } || { echo "ERROR: must run in Git Bash on Windows or WSL, not PowerShell/cmd" >&2; exit 1; }

echo "========================================"
echo "  Release build — $(date '+%H:%M:%S')"
echo "========================================"

npm run build

echo "========================================"
echo "  Build complete — $(date '+%H:%M:%S')"
echo "========================================"
