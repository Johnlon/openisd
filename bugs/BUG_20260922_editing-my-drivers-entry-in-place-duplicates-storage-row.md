# BUG_20260922_editing-my-drivers-entry-in-place-duplicates-storage-row

Status: OPEN (re-verified 2026-09-26) — `commitToMyDrivers()` calls `upsert` with no id, so a new row is appended (`DriverEditorModal.vue`, `savedEntries.ts`).

## Symptom
Editing an existing My Drivers entry (pencil-edit on a My Drivers row) and clicking OK
without changing brand/model — a plain "save my edits" with no rename — does not update
that entry in place. It adds a SECOND row to My Drivers instead, leaving the original
untouched. Repeating the edit keeps piling up more duplicate-looking rows.

## Evidence
Found via a scratch probe
([build/tmp](http://localhost:8000/winisd/openisd/build/tmp?html), git-ignored, deleted
after use — not a permanent test): seeded one My Drivers entry (uuid
`dcb35718-3d01-418e-d898-ea7394432e6b`), opened its pencil edit
(`editMyDriver` → [driverSelection.ts:160-164](http://localhost:8000/winisd/openisd/packages/ui/src/logic/driverSelection.ts#L160-L164),
which sets `subject = {kind:'myDriver', openedAs: uuid}`), clicked OK then the save-confirm
button with no brand/model change. `localStorage['openisd_my_drivers']` afterward held TWO
entries:
```
{"uuid":"dcb35718-...","record":{"uuid":{"value":"dcb35718-..."}, ...}}   // original, untouched
{"uuid":"2d84d854-...","record":{"uuid":{"value":"dcb35718-..."}, ...}}   // NEW row, same domain identity
```
The no-rename save path lands in the final `else` branch of `confirmSaveToMyDrivers()`
([DriverEditorModal.vue:~445](http://localhost:8000/winisd/openisd/packages/ui/src/ui/components/DriverEditorModal.vue?html#L445)),
which calls `commitToMyDrivers(draftDriver.value)`. `commitToMyDrivers()`
([DriverEditorModal.vue:~87](http://localhost:8000/winisd/openisd/packages/ui/src/ui/components/DriverEditorModal.vue?html#L87))
calls `myDrivers.upsert(driver)` with no uuid argument. `upsert()`
([savedEntries.ts](http://localhost:8000/winisd/openisd/packages/persistence/src/repos/savedEntries.ts?html)):
`id = uuid ?? crypto.randomUUID()` — with no uuid passed, it ALWAYS mints a fresh
storage-slot id, even though `subject.openedAs` already holds the real storage uuid of the
row being edited.

## Cause
`commitToMyDrivers()`/the plain-save branch of `confirmSaveToMyDrivers()` never pass
`subject.openedAs` through to `myDrivers.upsert()`, so a true in-place edit (existing row,
no rename) is indistinguishable at the storage layer from filing a brand-new entry — it
always appends rather than overwriting.

The two resulting rows do correctly share one domain-record uuid (this path never calls
`copyAsNew()`), so favourites do NOT visibly split between them — this is a distinct defect
from
[BUG_20260922_favoriting-copied-driver-also-highlights-original.md](http://localhost:8000/winisd/openisd/bugs/BUG_20260922_favoriting-copied-driver-also-highlights-original.md?html):
that one was a missing `copyAsNew()`; this one is a missing uuid handed to `upsert()`.

## Fix
When `subject.kind === 'myDriver'` and `subject.openedAs` is non-empty (a real existing
row) and the save does not rename, `commitToMyDrivers()` must pass that uuid through to
`myDrivers.upsert(driver, subject.openedAs)` so the existing storage slot is overwritten
instead of a new one being minted.

## Verification
Not yet fixed — out of scope for the current bug-fix pass (this defect was discovered
while root-causing bug #4, not one of the originally reported bugs). Once fixed: repeat the
probe above (seed one entry, edit in place with no rename, confirm save) and assert
`localStorage['openisd_my_drivers']` still holds exactly one entry with the same storage
uuid it started with.
