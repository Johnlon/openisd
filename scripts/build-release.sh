#!/usr/bin/env bash
# Build the production dist for GitHub Pages deployment.
# Used by the release-drivers workflow (see .claude/skills/release-drivers.md).
# Output goes to packages/ui/dist/ — pushed to gh-pages by GitHub Actions.
set -euo pipefail
[ -z "${MSYSTEM:-}" ] && echo "ERROR: must run in Git Bash on Windows, not WSL or PowerShell" && exit 1

echo "========================================"
echo "  Release build — $(date '+%H:%M:%S')"
echo "========================================"

GITHUB_PAGES=true npm run build

echo "========================================"
echo "  Build complete — $(date '+%H:%M:%S')"
echo "========================================"
