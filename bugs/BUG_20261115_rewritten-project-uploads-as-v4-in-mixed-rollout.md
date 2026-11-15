# BUG_20261115_rewritten-project-uploads-as-v4-in-mixed-rollout

**Status:** OPEN

## Symptom
During a rollout, a device on the new build rewrites stored v3 projects to v4 at start-up. If such a project is later copied by Cloud
sync without the user editing it (a sync conflict copy), the copy is uploaded as v4. A device still on the old build then refuses it
with "saved by a newer OpenISD (schema version 4; this app reads up to 3). Please update the app to open it." The original project
is not harmed and the old device keeps the v3 doc; only the conflict copy is unreadable there until it updates.

## Steps to reproduce
1. Device A (new build) and device B (old build) share one Drive store holding a dual-coil project P at v3.
2. Start device A: P is rewritten to v4 locally. The ledger follows the rewrite, so nothing is uploaded.
3. Edit P on device B and sync, then on device A edit P too before syncing: a conflict arises and a conflict copy of P is made from A's v4 text.
4. Sync. The copy is uploaded as a v4 doc. Device B lists it and cannot open it (message above). Expected: the old device can open it, or does not receive it.

## Evidence
`packages/persistence/src/cloud/docs/projectDocs.ts` `putConflictCopy` takes the stored body as it is (`setProjectNameInBody(doc.body, name)`); `ledgerFollowsRewrite.ts` moves only the ledger hash. Not reproduced end to end with two devices in this task: from the code. This behaviour existed for the start-up compaction before T827; T827 neither adds nor removes it.

## Cause
A sync doc body is the stored text, so its schemaVersion is whatever the device stored.

## Fix
Not decided. Left as recorded (coordinator, 15 Nov 2026).

## Verification
Two-device rollout test: new build rewrites, old build lists the conflict copy.
