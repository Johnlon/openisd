#!/usr/bin/env bash
# Symlink the federated driver collections into drivers/ from a sibling
# winisd_drivers checkout, for local dev/DQ convenience only — the running
# app never needs this (federated sources are always fetched live via the
# GitHub API, never from local disk). Untracked; safe to re-run.
# Usage: bash scripts/link-driver-repo.sh
set -euo pipefail
# Must run in Git Bash on Windows (MSYSTEM set) or WSL (microsoft in /proc/version).
# PowerShell/cmd have no /proc, so they are still rejected.
{ [ -n "${MSYSTEM:-}" ] || grep -qi microsoft /proc/version 2>/dev/null; } || { echo "ERROR: must run in Git Bash on Windows or WSL, not PowerShell/cmd" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
SIBLING="$ROOT_DIR/../winisd_drivers"

if [ ! -d "$SIBLING" ]; then
  echo "ERROR: no sibling winisd_drivers checkout found at $SIBLING" >&2
  echo "  Clone it alongside this repo: git clone git@github.com:Johnlon/winisd_drivers.git \"$SIBLING\"" >&2
  exit 1
fi

COLLECTIONS=(dayton-audio loudspeakerdatabase parts-express sb-acoustics scan-speak soundimports wavecor)

for c in "${COLLECTIONS[@]}"; do
  if [ ! -d "$SIBLING/$c" ]; then
    echo "  SKIP $c — not found in $SIBLING"
    continue
  fi
  ln -sfn "../../winisd_drivers/$c" "$ROOT_DIR/drivers/$c"
  echo "  linked drivers/$c -> ../winisd_drivers/$c"
done
