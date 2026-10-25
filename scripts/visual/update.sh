#!/usr/bin/env bash
# Re-takes baselines after a change that alters screens on purpose.
#   bash scripts/visual/update.sh                 every screen
#   bash scripts/visual/update.sh <screen-id>...  only these (ids as in the baseline file names, e.g. mobile-tab-box)
# It then records the hash of the UI sources (scripts/visual/sources.txt) in packages/ui/test/visual/SOURCES.sha256;
# land.sh refuses a task that changes those sources without it matching.
# Then list the screens whose picture changed under `visual:` in the task file; land.sh refuses a task
# whose list and changed baselines differ, and publishes a before/after page when it lands.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
spec=packages/ui/test/visual/visual.browser.spec.ts
if [ "$#" -eq 0 ]; then
  bash scripts/test.sh "$spec" --update-snapshots
else
  # An id is "<skin>-<screen>"; the test title is "visual <skin> <screen>", and a screen name may hold "-".
  pattern="$(printf 'visual %s$|' "${@/-/ }" | sed 's/|$//')"
  bash scripts/test.sh "$spec" --update-snapshots -g "$pattern"
fi
# The hash says "every committed baseline matches these sources". A partial re-take proves it by
# comparing all screens before the hash is written.
[ "$#" -eq 0 ] || bash scripts/test.sh "$spec"
# shellcheck source=./lib.sh
. scripts/visual/lib.sh
visual_sources_hash > "$VISUAL_SOURCES_HASH_FILE"
git status --short -- packages/ui/test/visual | sed -n 's#^.. .*/\([^/]*\)\.png$#visual: changed \1#p'
