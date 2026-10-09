#!/usr/bin/env bash
# The ONLY reader of the live driver db. Refreshes the pinned snapshot from a clean winisd_drivers
# checkout: the 3 test fixtures, the committed bundle (packages/ui/public) and scripts/driver-snapshot.pin.
#   bash scripts/sync-driver-snapshot.sh [--corpus-root DIR]      (default DIR = ../winisd_drivers)
# SYNC_BUNDLE_CMD overrides the bundle command (tests only); it is run with: --corpus <dir> --force
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORPUS_ROOT="$ROOT/../winisd_drivers"
while [ $# -gt 0 ]; do
  case "$1" in
    --corpus-root) CORPUS_ROOT="${2:?--corpus-root needs a directory}"; shift 2 ;;
    *) echo "sync-driver-snapshot: unknown argument: $1" >&2; exit 2 ;;
  esac
done
die() { echo "sync-driver-snapshot: refused: $*" >&2; exit 1; }

[ -d "$CORPUS_ROOT" ] || die "$CORPUS_ROOT is not a git checkout (no such directory)"
git -C "$CORPUS_ROOT" rev-parse --is-inside-work-tree > /dev/null 2>&1 || die "$CORPUS_ROOT is not a git checkout"
status="$(git -C "$CORPUS_ROOT" status --porcelain)" || die "git status failed in $CORPUS_ROOT"
[ -z "$status" ] || die "$CORPUS_ROOT is not clean (uncommitted or untracked files): a pin must name a real commit"
COMMIT="$(git -C "$CORPUS_ROOT" rev-parse HEAD)"
DATASHEETS="$CORPUS_ROOT/db/datasheets"
[ -d "$DATASHEETS" ] || die "$DATASHEETS does not exist"

FIXTURES=(accuton/bd90-6-727/driver.json accuton/bd90-6-727/openisd.json dayton-audio/da215-8/openisd.json)
SNAP="$ROOT/packages/design/test/fixtures/driver-snapshot"
START=$SECONDS; STEPS=3
progress() { local el=$((SECONDS - START)); echo "sync $1/$STEPS ($((100 * $1 / STEPS))%) ${el}s elapsed, ETA $(( $1 > 0 ? el * (STEPS - $1) / $1 : 0 ))s: $2"; }

for f in "${FIXTURES[@]}"; do [ -f "$DATASHEETS/$f" ] || die "fixture source missing: $DATASHEETS/$f"; done
rm -rf "$SNAP"
for f in "${FIXTURES[@]}"; do mkdir -p "$SNAP/$(dirname "$f")"; cp "$DATASHEETS/$f" "$SNAP/$f"; done
progress 1 "copied ${#FIXTURES[@]} fixtures"

cd "$ROOT"
if [ -n "${SYNC_BUNDLE_CMD:-}" ]; then "$SYNC_BUNDLE_CMD" --corpus "$DATASHEETS" --force
else npx tsx scripts/bundle-drivers.mjs --corpus "$DATASHEETS" --force; fi
progress 2 "bundle regenerated"

node scripts/driverSnapshotPin.mjs "$ROOT" "$COMMIT"
progress 3 "pin written"
echo "sync-driver-snapshot: pinned winisd_drivers ${COMMIT:0:9} ($(git -C "$ROOT" status --short -- packages/ui/public | wc -l) bundle paths changed)"
