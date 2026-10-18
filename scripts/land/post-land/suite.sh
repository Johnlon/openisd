#!/usr/bin/env bash
# The full suite of the post-land run (FULL_SUITE_CMD in land.conf): unit, browser, then the shell tests.
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
# The suite runs alone: it takes the browser lock exclusive, so no agent browser spec run overlaps it
# (scripts/suite-lock.sh). The re-run holds the lock through every process it starts.
if [ -z "${SUITE_LOCK_HELD:-}" ]; then
  exec env SUITE_LOCK_HELD=1 bash scripts/suite-lock.sh exclusive -- bash "$0" "$@"
fi
# The suite draws on its own reserve (scripts/budget.conf, pool "suite"): nothing else uses it, so an agent's
# lint or unit run can never take the suite's memory, and the suite never waits for one.
if [ -z "${BUDGET_SUITE_HELD:-}" ]; then
  # shellcheck source=../../budget.conf
  . scripts/budget.conf
  exec env BUDGET_SUITE_HELD=1 bash scripts/budget.sh suite "$COST_SUITE_MB" -- bash "$0" "$@"
fi
. scripts/lib/ts-log.sh
run_start "post-land-suite"
trap 'run_end "post-land-suite" "$?"' EXIT  # every exit, early ones included, writes the end line
# Fixed, not sized from free memory at run time: the same tests every run.
. scripts/budget.conf
export OPENISD_FIXED_WORKERS="$SUITE_WORKERS"
src="${POST_LAND_SRC:?POST_LAND_SRC not set: start this through scripts/land/post-land/run.sh}"
[ "$(stat -c %d "$src")" = "$(stat -c %d .)" ] \
  || { echo "suite: $PWD and $src are on different filesystems, so node_modules cannot be hardlinked; put POST_LAND_DIR beside the clones" >&2; exit 2; }
for dir in $(cd "$src" && ls -d node_modules packages/*/node_modules 2> /dev/null); do
  [ -e "$dir" ] || { mkdir -p "$(dirname "$dir")"; cp -al "$src/$dir" "$dir"; }
done
# All three always run: a red unit half must not hide the browser or shell tests. Red when any failed.
unit=0; browser=0
run_start "post-land-unit"
node_modules/.bin/vitest run || unit=$?
run_end "post-land-unit" "$unit"
run_start "post-land-browser"
bash scripts/test-browser.sh || browser=$?
run_end "post-land-browser" "$browser"
shell=0
run_start "post-land-shell"
bash scripts/test-shell.sh || shell=$?
run_end "post-land-shell" "$shell"
echo "suite: unit exit $unit, browser exit $browser, shell exit $shell"
rc=0; [ "$unit" = 0 ] && [ "$browser" = 0 ] && [ "$shell" = 0 ] || rc=1
exit "$rc"
