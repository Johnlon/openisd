# BUG_20261009_post-land-unit-red-skips-browser-specs

**Status:** OPEN

## Symptom
A post-land run whose unit suite has a failing test never runs the browser specs. The red report
(`tasks/fixes/F<n>.yml`) lists only the unit failures; the browser half is reported as neither
passed nor failed.

Seen on e3be1afd (F2): one unit failure, no browser result in the log.

## Cause
`scripts/land/post-land/suite.sh` runs `set -euo pipefail`, then `npx vitest run` and
`bash scripts/test-browser.sh` as two plain commands. A non-zero exit from `vitest` ends the script
before the browser line.

## Fix
Not done (maryu owns the post-land scripts). Run both, keep each exit code, print both outputs, and
exit non-zero if either failed, so a red run reports everything.
