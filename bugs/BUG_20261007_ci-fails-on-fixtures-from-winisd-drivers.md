# BUG_20261007_ci-fails-on-fixtures-from-winisd-drivers

**Status:** RESOLVED (T022): the fixtures are vendored under packages/design/test/fixtures/driver-snapshot and pinned in scripts/driver-snapshot.pin; no test or build reads ../winisd_drivers. The deploy gate (fix 2) is not part of T022.

## Symptom
GitHub CI (`ci.yml`, job `test`, step `npm run test:unit`) has failed on every push today, run 37602023432 and
earlier. `deploy.yml` is a separate workflow on push to main with no dependency on CI, so openisd.app is
deployed from commits whose CI is red.

## Evidence
Six tests read fixtures from `../winisd_drivers/db`, a sibling repository the runner does not check out:
- `packages/ui/test/scripts/round-trip-gate.test.ts`: 5 tests (`accuton/bd90-6-727/openisd.json`, a
  `dayton-audio/da215…` file).
- `packages/design/test/winisd/bridge-bundle.test.ts`: 1 test (`accuton/bd90-6-727/driver.json`).
Failure text: `fixture missing: …/winisd_drivers/db/datasheets/accuton/bd90-6-727/openisd.json`.
The `bd90-6-727` folder is 36 KB; the whole `winisd_drivers` checkout is about 2 GB.

## Cause
Two things. The six tests depend on a repository CI never has, and `deploy` does not wait for `ci`.

## Fix (proposed, not applied)
1. Fixtures: copy the few files the six tests read into openisd test data (a read of `winisd_drivers/db`, never
   a write) and point the tests at the copy. Not checking out `winisd_drivers` in CI: it is about 2 GB and
   private to the tools project.
2. Deploy gate: make `deploy.yml` run on `workflow_run` of `ci` with `conclusion == 'success'` (or move the
   deploy job into `ci.yml` with `needs: test`).

## Verification
A push with the fixtures committed gives a green CI run. A push that breaks a test gives a red CI run and no
deploy.
