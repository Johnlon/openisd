# Cloud save trigger test: boot sync faults on a fake Drive reply (flaky)

Status: closed (T345)

Spec `cloud-save-trigger.browser.spec.ts` "connected, save a project" failed in CI runs on main (T344 run; run 39030899080 shard 1): the sync badge never showed "done" in 20 s.

Cause: not the app. The spec's stub answered every Drive files request with an empty file list, including the create (upload) of the open project. The app rightly called that reply "Not a file write reply" and showed "Sync failed ... Retrying". Whether a create happens before the badge check depends on timing (project opened before or after the first sync), so it passed most runs.

Fix: the spec uses the Drive emulator (`connectedToDrive`), which answers creates, lists and changes like Drive.

Also: the old stub's fault was the only reason the save "made a request" in some runs (the failed create was retried). With the emulator, saving an unchanged project correctly uploads nothing, so the spec now edits the design before saving.
