#!/usr/bin/env bash
# The full suite of the post-land run (FULL_SUITE_CMD in land.conf): unit, then browser.
# Runs in the clean copy, which has no node_modules; run.sh exports POST_LAND_SRC, the clone that
# started the run, and its node_modules are hardlinked in (no install, no network).
set -euo pipefail

# This file is scripts/land/post-land/suite.sh: the repo root is three levels up, not two (12 Oct:
# every post-land suite ran from scripts/ and died on "scripts/admit.sh: No such file", F10).
cd "$(dirname "${BASH_SOURCE[0]}")/../../.." || exit 1

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
# Both halves always run: a red unit half must not hide the browser half. Red when either failed.
unit=0; browser=0
node_modules/.bin/vitest run || unit=$?
bash scripts/test-browser.sh || browser=$?
echo "suite: unit exit $unit, browser exit $browser"
[ "$unit" = 0 ] && [ "$browser" = 0 ]
