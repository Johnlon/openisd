# BUG_20261017_landing-skips-architecture-tests

**Status:** FIXED (T299)

## Symptom
On 17 Oct, main went red on architecture unit tests that no landing ran:
- F52: browser-fixture-settles-routes (T250);
- F53: architecture-no-globals and architecture-engine-boundary (T275).

Every later landing was refused until each was fixed.

## Cause
land.sh's unit gate (`scripts/land/unit-changed.sh`) runs the tests vitest's import graph links to the
changed files (`--changed origin/main`). An architecture test reads the source tree as files and imports
none of it, so the graph never picks it.

## Fix
A new mandatory land.sh gate, `architecture`, runs `scripts/land/unit-architecture.sh` on every landing,
whatever changed. That script runs every `packages/**/architecture*.test.ts` and
`packages/**/architecture/**` test: 35 files, about 45 s. land.conf sets `ARCHITECTURE_CMD`, and a
land.conf without it refuses.

Proof:
- Run on main's tree at 52415b60, the gate fails exactly F53's two tests, so it would have refused T275.
- `scripts/land/test/land.e2e.test.sh` tests three things:
  - an architecture failure refuses and names the gate;
  - the gate runs on a landing that changes no package file;
  - a missing `ARCHITECTURE_CMD` refuses.
