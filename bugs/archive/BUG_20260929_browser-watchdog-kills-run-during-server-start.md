# BUG_20260929_browser-watchdog-kills-run-during-server-start

**Status:** FIXED 2026-10-05 — the abort-on-load symptom is gone: `scripts/test-browser.sh` waits up to 180 s for the first answer from Vite before it counts failures (09c60b00), and the idle watchdog in `scripts/quiet-test.sh` counts log growth, CPU use and lane queueing as progress. Not done, optional speedups only: bundling still runs inside `webServer.command`, and `test-bundle-paths.json` still lists 5 drivers.

## Symptom
`scripts/test-browser.sh` aborts with "WATCHDOG: Vite server on port 4100 is unreachable"
before any test runs, when the machine is loaded. Happened twice in a row on 2026-09-29
(multi-chart branch), with no test failing.

## Evidence
- `scripts/test-browser.sh` `run_with_watchdog`: sleeps 15 s, then 3 failed 2 s curls 5 s apart
  kill Playwright, about 36 s after start.
- `playwright.config.js` `webServer.command` runs `kill-http.sh`, `version-info.mjs`,
  `test-bundle.mjs`, then a cold `vite` start; its own `timeout` is 120000 ms.
- The watchdog clock starts with Playwright, so server start-up (including bundling) counts
  against 36 s, not the 120 s the config allows.
- `build/test-bundle` is 76 KB: `test-bundle.mjs` already bundles only the paths in
  `packages/ui/test/fixtures/test-bundle-paths.json`.

## Cause
The watchdog is meant to catch a server that dies mid-run, but it also fires while the server
is still starting.

## Fix
John, 2026-09-29: bundling must not be a timeout activity, and a test server needs only the 2–3
reference drivers. So:
- build the bundle before the timed part, outside the watchdog;
- arm the watchdog only after the server has first answered;
- trim `test-bundle-paths.json` to the reference drivers the specs actually open.

## Verification
Run one targeted spec (`-g`) under load: no watchdog abort while the server starts, and an
abort still fires if the server is killed mid-run.
