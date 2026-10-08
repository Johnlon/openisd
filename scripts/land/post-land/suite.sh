#!/usr/bin/env bash
# The full suite of the post-land run (FULL_SUITE_CMD in land.conf): unit, then browser.
# Runs in the clean copy, which has no node_modules; run.sh exports POST_LAND_SRC, the clone that
# started the run, and its node_modules are hardlinked in (no install, no network).
set -euo pipefail
src="${POST_LAND_SRC:?POST_LAND_SRC not set: start this through scripts/land/post-land/run.sh}"
[ "$(stat -c %d "$src")" = "$(stat -c %d .)" ] \
  || { echo "suite: $PWD and $src are on different filesystems, so node_modules cannot be hardlinked; put POST_LAND_DIR beside the clones" >&2; exit 2; }
for dir in $(cd "$src" && ls -d node_modules packages/*/node_modules 2> /dev/null); do
  [ -e "$dir" ] || { mkdir -p "$(dirname "$dir")"; cp -al "$src/$dir" "$dir"; }
done
npx vitest run
bash scripts/test-browser.sh
