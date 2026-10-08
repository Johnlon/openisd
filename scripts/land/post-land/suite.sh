#!/usr/bin/env bash
# The full suite of the post-land run (FULL_SUITE_CMD in land.conf): unit, then browser.
# Runs in the clean copy, which has no node_modules; run.sh exports POST_LAND_SRC, the clone that
# started the run, and its node_modules are hardlinked in (no install, no network).
set -euo pipefail
# The full suite is a heavy job: it runs in the machine's one admission slot (scripts/admit.sh).
# admit.sh exports ADMIT_TOKEN, so the re-run below does not queue a second time.
if [ -z "${ADMIT_TOKEN:-}" ]; then
  exec bash scripts/admit.sh "post-land suite $(basename "$PWD")" -- bash "$0" "$@"
fi
src="${POST_LAND_SRC:?POST_LAND_SRC not set: start this through scripts/land/post-land/run.sh}"
[ "$(stat -c %d "$src")" = "$(stat -c %d .)" ] \
  || { echo "suite: $PWD and $src are on different filesystems, so node_modules cannot be hardlinked; put POST_LAND_DIR beside the clones" >&2; exit 2; }
for dir in $(cd "$src" && ls -d node_modules packages/*/node_modules 2> /dev/null); do
  [ -e "$dir" ] || { mkdir -p "$(dirname "$dir")"; cp -al "$src/$dir" "$dir"; }
done
# Tests find the corpus as a sibling of the repo (../winisd_drivers). The clean copy sits in
# POST_LAND_DIR, so link that sibling to the starting clone's: read only, nothing is written to it.
copy_parent="$(dirname "$PWD")"
[ -e "$copy_parent/winisd_drivers" ] || ln -s "$(dirname "$src")/winisd_drivers" "$copy_parent/winisd_drivers"
npx vitest run
bash scripts/test-browser.sh
