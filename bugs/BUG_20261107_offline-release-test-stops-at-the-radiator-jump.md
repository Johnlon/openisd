# BUG_20261107_offline-release-test-stops-at-the-radiator-jump

**Status:** FIXED: fault 1 fixed (T704), fault 2 fixed (T706)

## Symptom
1. `scripts/hosting/test/offline-catalogue.e2e.mjs` times out after 30 s in `pickRadiatorOffline`, so `scripts/release.sh` refuses to release.
2. `scripts/release.sh` runs its upgrade test on the checkout it is started from, not on the snapshot named on its command line. A release of an older build tests newer code.

## Evidence
- Reported by the cover session on 7 Nov 2026 while releasing 7.0.958.
- After the pick the test reads `#np-pr-vas` inside `.mob-np-body`. Since T702 a pick moves on to the project page, where that box is not drawn.

## Cause
1. T702 changed what a pick does (QO442) and did not change this test. Landing gates do not run it, so T702 landed green.
2. `release.sh` calls the test from the working tree, with no step that checks out the named snapshot's code.

## Fix
1. After the pick the test presses Back, as a person would, then checks every box still fills offline.
2. Fixed by T706: `release.sh` runs both e2e checks in a temporary detached worktree at the snapshot's commit (node_modules symlinked from the starting checkout), removed on every exit.

## Verification
1. `node scripts/hosting/test/offline-catalogue.e2e.mjs --previous https://openisd.app`, the form `release.sh` runs.
