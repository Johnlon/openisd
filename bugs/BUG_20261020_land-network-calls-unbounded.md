# BUG_20261020_land-network-calls-unbounded

**Status:** FIXED

Recorded 20 Oct 2026 by maryu. From the load audit (rows 7, 8, 9), task T489.

## Symptom
1. `land.sh` runs `git fetch`, the candidate push, the main push and `gh pr create` with no bound, while it holds the one
   landing lock. A network stall holds the lock forever and every other landing waits at `flock 9`.
2. The browser run's `webServer.timeout` (300 s) also covers the deterministic `vite build`. Under load the build passes
   5 min and the whole run fails with "Timed out waiting 300000ms from config.webServer".
3. Every concurrent browser run writes and serves the same `build/test-bundle`. A second run empties it while the first
   is mid-spec, so the first gets 404s on driver JSON.

## Cause
1. No `timeout` on those calls (`scripts/land.sh`, `scripts/land/pr.sh`).
2. One `webServer.timeout` for build plus server start (`playwright.config.js`).
3. Only the dist dir is per port; the bundle dir name is fixed.

## Fix
1. `timeout` (default 120 s, `LAND_NET_TIMEOUT_S`) on fetch, both pushes, the candidate-branch delete and every `gh` call; on timeout a loud
   refusal naming the call. Nothing deterministic is bounded.
2. The build runs before Playwright starts (`scripts/build-test-app.sh`, called by `test-browser.sh` and `run-ui-telemetry.sh`; CI already builds in its own job), with no deadline. Playwright reads `webServer.timeout: 0` as its 60 s default, so the webServer now only serves, with a 300 s start timeout.
3. The bundle is `build/test-bundle-<port>`, one name used by the builder, the preview server, the cloud-sync spec and the
   CI artifact upload. Like `build/test-dist-<port>`, nothing removes it automatically; `build/` is untracked.

Fixed by T489.
