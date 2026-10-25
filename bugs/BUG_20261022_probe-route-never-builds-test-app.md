# BUG_20261022_probe-route-never-builds-test-app

**Status:** FIXED (T569)

## Symptom
The documented probe route `npx playwright test -c scripts/playwright.probe.config.mjs build/tmp/<spec>` fails with "Timed out waiting 300000ms from config.webServer". A probe named `zz-foo.spec.ts` gives "No tests found".

## Cause
- Since T489 the webServer only serves a prebuilt dist (`vite preview`); the build runs in `scripts/test-browser.sh` before Playwright, and the bare probe route never built.
- The probe config inherited `testMatch: '**/*.browser.spec.ts'`.

## Fix
- Probe route is `bash scripts/test-browser.sh -c scripts/playwright.probe.config.mjs build/tmp/<spec>` (already passes args through; one build path, `build-test-app.sh`). Docs and recorder headers updated.
- Probe config `testMatch` covers `*.spec.ts` and `*.browser.spec.ts`.

## Verification
`bash scripts/test.sh packages/design/test/scripts/probe-config.test.ts`; a trivial `build/tmp/zz-t569.spec.ts` ran green through the new route.
