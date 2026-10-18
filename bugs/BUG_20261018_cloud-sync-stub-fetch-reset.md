# BUG_20261018_cloud-sync-stub-fetch-reset

**Status:** RESOLVED

## Symptom
`cloud-sync-activity.browser.spec.ts:32` (desktop: the Cloud sync dialog lists each project sent and received) failed
at random: red in F55 at 1789a508, and red again on the T406 candidate (run 39145022452). The report shows the click
on `.cloud-sync-badge` ending with "Test ended". The first error is `route.fetch: read ECONNRESET` (locally:
`route.fetch: socket hang up`), at the page reload.

## Cause
The test stand-in for a build with a Google client id (`enableCloudSync`) fetched the app's main script with
`route.fetch()`. That request goes through the test runner's pooled keep-alive connection to the suite's `vite preview`
server, which closes idle connections after 5 s. Under load the runner reused a connection the server was closing,
and the fetch was reset. The badge never appeared, because the page's main script never arrived. In the local
failure, the fetch came 6.9 s after the worker's previous one. The exact timing of the close is not proven.

The same stub was copied into `cloudSyncDialog.browser.spec.ts` and `redirectRoundTrip.browser.spec.ts`.

Not an app bug: the app makes no request on this path.

## Reproduction
Loaded run (6 busy CPU loops, 4 workers): `bash scripts/test.sh packages/ui/test/ui/cloud-sync-activity.browser.spec.ts
--repeat-each=20 --workers=4` failed 1 of 40, and `--repeat-each=40` failed 1 of 80.

## Fix
`packages/ui/test/ui/fixtures/cloudSyncStubs.ts`: the stub reads the built main script from
`build/test-dist-<port>/` on disk and fulfils it with the client id set. Nothing is fetched through the runner. The
two copies now import the shared stub. `packages/ui/test/architecture/browser-specs-never-fetch-through-runner.test.ts`
fails if any spec or fixture calls `route.fetch()`.

## Verification
- The same loaded run after the fix: 80 of 80 passed.
- `cloudSyncDialog.browser.spec.ts` and `redirectRoundTrip.browser.spec.ts` pass (7 tests).
- The architecture test passes; on the previous commit it would fail on three `route.fetch(` calls.
