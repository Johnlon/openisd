# BUG_20261118_cloud-live-sync-spec-waits-for-done-cloud-after-conflict

**Status:** FIXED by T898 (the change that makes the "both devices edit" cloud sync spec wait for the conflict mark).

## Symptom
Main's suite run 44292118892 failed in `packages/ui/test/ui/cloud-live-sync.browser.spec.ts` "both devices edit before either syncs: both versions kept, and the notice names both projects": `.cloud-sync-badge .icon-cloudDone` never became visible. It passed in the pull request's own runs, so it was intermittent.

## Cause
The app is right. When Sync now keeps both versions of a project, the badge ends on the alert cloud with the count 1 (`packages/design/cloud/syncDisplay.ts`, synced with conflicts > 0), never the done cloud. The spec's `syncNow` helper (line 43) waited for the done cloud anyway. It passed only because the cloud left over from before the click (Up to date) was still showing at the moment of the check; a probe of the badge after the click showed done at 2 ms, syncing at 68 ms, alert with 1 at 131 ms. When the edit-triggered run was still going (as on a loaded CI machine), the badge was not done at the check and went straight to the alert, so the wait timed out.

## Fix
The conflict test now waits for what a user sees: the alert cloud with the count 1 (`syncNowKeepingBoth`). A unit test pins that a synced status with one conflict shows the alert cloud and the count 1.
