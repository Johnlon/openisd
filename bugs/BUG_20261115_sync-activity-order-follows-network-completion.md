# BUG_20261115_sync-activity-order-follows-network-completion

**Status:** OPEN (found when the Cloud sync dialog baselines drew two ways; to be fixed in its own task, not in T793)

## Symptom
With two or more new items to upload, the Cloud sync dialog's Activity list (newest first) shows `Project "sample-project" sent` above `Project "complete-driver-project" sent`
in one run and the other way round in the next, for the same inputs (visual re-take runs 43710725421 and 43712316674, `desktop-dialog-cloud-confirm` and `desktop-dialog-settings-cloud-account-and-activity`).
A user with two or more projects uploading in one first sync sees the same order change between devices and runs. Cosmetic; no data effect.

## Cause
`syncEngine.ts` uploads new items four at a time and tells Activity as each upload finishes, so the order of the list is the order Drive happens to answer in. Telling in the order
the items are planned does not fix it: the plan follows the stored order, and a project's stored id is random.

## Fix (own task)
The order of the list must be the same for the same set of items, and each upload must still be reported as it completes (a long first sync should keep its progress). Order at display
time (by name for items with the same time) rather than delaying the telling. Test first: three new items whose uploads finish in reverse order; the displayed order is by name.
The four cloud dialog baselines (`cloud`, `cloud-confirm`, `settings-cloud-account-and-activity`, `desktop-dialog-cloud-confirm`) wait for this fix (`WAITING_FOR_FIX`).
