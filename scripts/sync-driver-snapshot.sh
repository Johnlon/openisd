#!/usr/bin/env bash
# Refreshes the pinned OpenISD bundle from the committed winisd_drivers snapshot:
# the 3 test fixtures, the committed bundle (packages/ui/public) and scripts/driver-snapshot.pin.
#   bash scripts/sync-driver-snapshot.sh [--corpus-root DIR]      (default DIR = ../winisd_drivers)
# SYNC_BUNDLE_CMD overrides the bundle command (tests only); it is run with: --corpus <dir> --force
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORPUS_ROOT="$ROOT/../winisd_drivers"
ONLY_RECORDS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --corpus-root) CORPUS_ROOT="${2:?--corpus-root needs a directory}"; shift 2 ;;
    --only-record) ONLY_RECORDS+=("${2:?--only-record needs an exact brand/sku path}"); shift 2 ;;
    *) echo "sync-driver-snapshot: unknown argument: $1" >&2; exit 2 ;;
  esac
done
die() { echo "sync-driver-snapshot: refused: $*" >&2; exit 1; }

[ -d "$CORPUS_ROOT" ] || die "$CORPUS_ROOT is not a git checkout (no such directory)"
git -C "$CORPUS_ROOT" rev-parse --is-inside-work-tree > /dev/null 2>&1 || die "$CORPUS_ROOT is not a git checkout"
DATASHEETS="snapshot/datasheets"

# Build strictly from the committed snapshot tree. Scraper work in db/, db.2/, snapshot/runs,
# and uncommitted snapshot edits cannot enter the OpenISD bundle.
git -C "$CORPUS_ROOT" ls-files --error-unmatch snapshot/datasheets > /dev/null 2>&1 \
  || die "snapshot/datasheets is not tracked by git; commit the OpenISD snapshot first"
COMMIT="$(git -C "$CORPUS_ROOT" log -1 --format=%H HEAD -- snapshot/datasheets)"
[ -n "$COMMIT" ] || die "no committed history found for snapshot/datasheets"
WORK_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/openisd-driver-snapshot.XXXXXX")"
trap 'rm -rf "$WORK_ROOT"' EXIT
git -C "$CORPUS_ROOT" archive "$COMMIT" snapshot/datasheets | tar -x -C "$WORK_ROOT" \
  || die "could not extract committed snapshot $COMMIT"
DATASHEETS="$WORK_ROOT/snapshot/datasheets"
[ -d "$DATASHEETS" ] || die "committed snapshot $COMMIT has no snapshot/datasheets tree"

FIXTURES=(accuton/bd90-6-727/driver.json accuton/bd90-6-727/openisd.json dayton-audio/da215-8/openisd.json)
SNAP="$ROOT/packages/design/test/fixtures/driver-snapshot"
START=$SECONDS; STEPS=3
progress() { local el=$((SECONDS - START)); echo "sync $1/$STEPS ($((100 * $1 / STEPS))%) ${el}s elapsed, ETA $(( $1 > 0 ? el * (STEPS - $1) / $1 : 0 ))s: $2"; }

for f in "${FIXTURES[@]}"; do [ -f "$DATASHEETS/$f" ] || die "fixture source missing: $DATASHEETS/$f"; done
rm -rf "$SNAP"
for f in "${FIXTURES[@]}"; do mkdir -p "$SNAP/$(dirname "$f")"; cp "$DATASHEETS/$f" "$SNAP/$f"; done
progress 1 "copied ${#FIXTURES[@]} fixtures from committed snapshot"

cd "$ROOT"
# shellcheck source=/dev/null
. "$(dirname "${BASH_SOURCE[0]}")/lib/main-folder.sh"
refuse_in_main_folder sync-driver-snapshot
BUNDLE_ARGS=(--corpus "$DATASHEETS")
for path in "${ONLY_RECORDS[@]}"; do BUNDLE_ARGS+=(--only-record "$path"); done
BUNDLE_ARGS+=(--force)
if [ -n "${SYNC_BUNDLE_CMD:-}" ]; then "$SYNC_BUNDLE_CMD" "${BUNDLE_ARGS[@]}"
else npx tsx scripts/bundle-drivers.mjs "${BUNDLE_ARGS[@]}"; fi
progress 2 "bundle regenerated"

node scripts/driverSnapshotPin.mjs "$ROOT" "$COMMIT"
progress 3 "pin written"
echo "sync-driver-snapshot: pinned winisd_drivers ${COMMIT:0:9} ($(git -C "$ROOT" status --short -- packages/ui/public | wc -l) bundle paths changed)"
