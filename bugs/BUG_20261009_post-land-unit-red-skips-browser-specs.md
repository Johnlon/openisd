# BUG_20261009_post-land-unit-red-skips-browser-specs

**Status:** OPEN. Rides T017 (lots writes the task file), test first.

There are two halves of the post-land suite, unit (`npx vitest run`) and browser
(`bash scripts/test-browser.sh`), run one after the other by `scripts/land/post-land/suite.sh`
under `set -euo pipefail`. When the unit half fails, the script exits there and the browser half
never runs, so one red unit spec hides every browser red and the next fix cycle starts blind.

We need: both halves always run; the run is red when either failed, and the fixes task lists the
failed specs of BOTH halves.

Test: scratch suite where the unit half fails and the browser half also fails; both halves run
(each leaves a marker) and the exit status is non-zero; the browser failure is in the output.
