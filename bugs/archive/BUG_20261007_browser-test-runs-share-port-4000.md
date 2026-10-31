# BUG_20261007_browser-test-runs-share-port-4000

**Status:** RESOLVED 2026-10-07

## Symptom
Browser test runs from different sessions kill or reuse each other's dev server and fail each other's tests.
The health check's Verify Preview step also visits John's live preview on port 4000.

## Evidence
Checked 2026-10-07 with `git grep`. Specs and fixtures never hard-code 4000; `test.sh` -> `test-browser.sh` already
reserves a port per run from a pool of 8 (4100-4107). Three holes remained:
- the pool only knew ports reserved by our own runs, not ports something else was listening on, and
  `test-browser.sh` runs `kill-http.sh` on the chosen port, so it could kill a stranger's server;
- with more than 8 runs, the pool reused a port;
- `playwright.config.js` had `reuseExistingServer: true`, so a run could latch onto another run's server;
- `health-check.sh` Verify Preview used `verify-preview.sh`, fixed on port 4000 (John's preview).

## Cause
Port choice checked only the reservation files, not the real listeners, and Playwright was told to share any server
it found.

## Fix
- `scripts/test-concurrency.sh`: pool is 4100-4189 and skips any port that has a listener.
- `playwright.config.js`: `reuseExistingServer: false`; ad-hoc range stays 4200+.
- `scripts/verify-preview.sh`: port from `OPENISD_PREVIEW_PORT`, default 4000 (manual use unchanged).
- `scripts/verify-preview-own-port.sh` (new): starts a throwaway vite on a reserved port and verifies that;
  `health-check.sh` calls it. `preview-4000.sh` is untouched.

## Verification
Two small specs run at the same time through `scripts/test.sh`: one reserved port 4100, the other 4101, both
passed. `verify-preview-own-port.sh` passed on port 4101. No run touched 4000.
