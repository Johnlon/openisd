#!/usr/bin/env bash
# Runs in the visual-retake workflow's test machine only (T799): draws every screen with Playwright, proves the drawing
# is stable by running the spec again against what it just wrote, and collects into <out-dir> the pictures that differ
# from the committed ones, stamped with this run's id, with MANIFEST.sha256 and SOURCES.sha256.
#   bash scripts/visual/ci-draw.sh <out-dir>
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
# shellcheck source=./can-draw.sh
. scripts/visual/can-draw.sh
visual_can_draw || { echo "ci-draw: this is not the visual-retake test machine; baselines are drawn only there (scripts/visual/update.sh asks it to)" >&2; exit 1; }
out="${1:?usage: ci-draw.sh <out-dir>}"
# shellcheck source=./lib.sh
. scripts/visual/lib.sh
spec=packages/ui/test/visual/visual.browser.spec.ts
before="$(mktemp -d)"; cp -r "$VISUAL_SNAPSHOT_DIR/." "$before/"
git config --global --add safe.directory "$PWD"
npx playwright test "$spec" --update-snapshots=changed --retries=0
# a second run, no update: every picture must now match what was just written, with no tolerance
npx playwright test "$spec" --retries=0
rm -rf "$out"; mkdir -p "$out/pictures"
for f in "$VISUAL_SNAPSHOT_DIR"/*.png; do
  b="$(basename "$f")"
  cmp -s "$f" "$before/$b" 2> /dev/null || cp "$f" "$out/pictures/$b"
done
for b in $(cd "$before" && ls); do [ -e "$VISUAL_SNAPSHOT_DIR/$b" ] || echo "ci-draw: note: $b is committed but no screen draws it"; done
if [ -n "$(ls -A "$out/pictures")" ]; then node scripts/visual/png-stamp.mjs stamp "${GITHUB_RUN_ID:?}" "$out"/pictures/*.png; fi
( cd "$out/pictures" && { ls *.png 2> /dev/null || true; } | sort | xargs -r sha256sum ) > "$out/MANIFEST.sha256"
visual_sources_hash > "$out/SOURCES.sha256"
echo "ci-draw: run $GITHUB_RUN_ID: $(ls "$out/pictures" | wc -l) picture(s) differ from the committed ones"
