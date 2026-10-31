# BUG_20261031_layout-upgrade-makes-conflict-copies

**Status:** FIXED 31 Oct 2026 (T622). A data-integrity bug in the layout upgrade itself, present for every layout bump, not only 2 to 3.

## John's rulings, 31 Oct 2026
- On losing the sync record: "isn't an upgrade it is a corruption".
- On the comparison: "its not a conflict if we upgrade the project we are importing the same way we upgrade a project we find in memory".

- QO314, on one key for a project: "ok it seems obvious we use one key fot the project the whole time - why not", then "yes".
- QO315, on texts with no id: "dont refuse data we can fix - refucing doesnt help as the human cant fix it".
- On refusals: "refusing alone isnt asolution user will be happy with".

## Symptom
A browser synced with Google Drive at storage layout 2 loads the layout-3 app. After the upgrade, sync made a "(conflict, ...)" copy of every project, on Drive and in the browser, although nothing was edited on either side. Unseen-conflict notices from before the upgrade were also lost.

## Cause (two things)
- **The upgrade forgot the sync record.** The store upgrade (`storeGate.ts`) called `onReplaced`, which in `main.ts` is `forgetCloudSyncRecord`. The ledger (what was synced, which Drive revision, which hash) and the conflict notices were wiped. With no ledger row, a project present on both sides is a conflict.
- **The comparison used the wrong hash.** When sync downloads a Drive doc below the app layout it upgrades the body with the same layout steps as the local store, but kept comparing the hash Drive holds, which is of the old body, with the hash of the upgraded local text. They differ, so the rules saw two edits and kept both.

## Fix
- The upgrade no longer forgets the record. `storeGate.ts` tells `projectRewritten` (the same ledger-follows-rewrite used for stored-text compaction, `ledgerFollowsRewrite.ts`) of each saved project whose text the migration changed, so the ledger hash moves to the upgraded text and the project is not seen as edited. Conflict notices stay. `onReplaced` is now only for restore, reset and repair.
- Sync compares the upgraded remote body, not Drive's hash: after a remote body is upgraded the engine uses the hash of the upgraded body (`syncEngine.ts`). One upgrade path serves local and remote (the layout steps); there is no second copy of it.
- A remote doc below the app layout that is the same once upgraded is pushed up, so Drive holds the new layout in the same file (`syncEngine.ts`, `pushUpdate` in place of `nothing` or `adopt`). A changes-only run never sees an unchanged older doc, so the migration drops the change cursor (`createLedgerFollowsMigration`): the first run after the upgrade lists every Drive file, and Drive reaches layout 3 on that run.
- Limit: the ledger follows saved projects only. The layout steps so far (1 to 2, 2 to 3) change no other synced doc's text. A later step that does must tell the ledger the same way.

## One key for a project (QO314)
- The saved-projects store key is the project id. `storedIdentity` is gone from `projectRepo.ts`; a project read from the store takes its entry's id, a save writes under `project.uuid()`, and `storedIdOf` / `isStored` ask the store whether an entry has that id. The 2 to 3 layout step already gave every stored entry, open session and autosave the entry id as the project id; the ledger and cloud docs were always keyed by it, so no second upgrade is needed.
- A file, share link or archive whose id is already stored keeps the id only when its design equals the stored one (the same project read again); a different design takes a new id, so it never overwrites a saved project (`claimId`, used by `readProjectText`, `loadFromHash` and `storeNew`). `storeNew` no longer maps a copy to a stored entry by content.
- A project saved over another through `saveToStorageAs(project, id)` becomes that project (`OpenISDProject.adoptId`).

## No refusing of data we can fix (QO315)
- A project text with no id, at any layout, from a file or link, is given one on read from the injected AppContext, never refused (`project-id.test.ts`, `projectRepo.test.ts`). A text the strict read refuses still gets its id and nothing else in the layout step (`textWithId`), also in the quarantined session.

## Refusals that remain, and the next step each gives
- A `.owpr` or `.owdr` from a newer layout: refused, the file is untouched; the message now says to reload the page to get the latest OpenISD and open it again (`projectRepo.readProjectText`, `fileImportExport.driverFromText`). Builds already shipped still show the bare message and cannot change.
- A store written by a newer layout: not opened; offers a restore, a read-only view or a raw export (`storeGate`). Already had a next step.
- Drive docs from a newer layout: held, not touched, and the sync badge says "Update the app to sync N projects saved by a newer version".
- A tab on an older build writing into a store a newer build has taken: the write is refused with "Reload this tab to keep working; nothing was lost", and the store layout is never lowered (`stampedStore.ts`).
- Share links that are not a session payload and project entries that cannot be read: refused with the reason; unreadable open-session entries are kept whole as refused copies. No further next step was added for these.

## Tests
- `packages/persistence/test/cloud/forgetOnReplace.test.ts`: a migration does not call `onReplaced` and tells `projectRewritten` of each changed project.
- `packages/persistence/test/cloud/syncEngine.test.ts`: a remote doc below the app layout that upgrades to the local body makes no conflict copy and is pushed at the new layout.
- `packages/persistence/test/layoutSteps.test.ts`, `stampedStore.test.ts`, `cloud/ledgerFollowsRewrite.test.ts`, `projectRepo.test.ts`: the id for refused texts, the layout never lowered, the cursor drop, the one-key rules, and that the migrated text equals the first save under non-default user settings.
- `packages/ui/test/ui/cloud-layout-upgrade.browser.spec.ts`: a layout-2 store synced with a layout-2 Drive stub (ledger in step, one unseen conflict notice) loads in the layout-3 app and syncs: no new conflict copy, Drive holds layout 3 in the same file, the old notice is still shown.

## Not done
A project edited on both devices during the upgrade still conflicts, as it should.
