#!/usr/bin/env bash
# Build the production dist for GitHub Pages deployment.
# Used by the release-drivers workflow (see .claude/skills/release-drivers.md).
# Output goes to packages/ui/dist/ — pushed to gh-pages by GitHub Actions.
set -euo pipefail
# Must run in Git Bash on Windows (MSYSTEM set) or WSL (microsoft in /proc/version).
# PowerShell/cmd have no /proc, so they are still rejected.
{ [ -n "${MSYSTEM:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; } || { echo "ERROR: must run in Git Bash on Windows or WSL, not PowerShell/cmd" >&2; exit 1; }

echo "========================================"
echo "  Release build — $(date '+%H:%M:%S')"
echo "========================================"

# Standing order: a release build starts from a clean scratch dir. build/ is the repo-local,
# gitignored throwaway (screenshots, probe scripts, stale nested checkouts) — purge it wholesale
# so old crap never accumulates. Nothing the release build produces lives here (dist → packages/ui/dist/).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -d "$ROOT/build" ]; then
  echo "  Cleaning scratch: removing build/ ($(du -sh "$ROOT/build" 2>/dev/null | cut -f1 || echo '?'))"
  rm -rf "$ROOT/build"
fi
mkdir -p "$ROOT/build"   # keep the empty dir as the sanctioned scratch location

GITHUB_PAGES=true npm run build

echo "========================================"
echo "  Build complete — $(date '+%H:%M:%S')"
echo "========================================"
