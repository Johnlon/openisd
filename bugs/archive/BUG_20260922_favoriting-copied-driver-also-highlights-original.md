# BUG_20260922_favoriting-copied-driver-also-highlights-original

Status: RESOLVED (re-verified 2026-09-26) — confirmed: favourites key on the record uuid (`driverDisplay.ts`), which a clone changes.

Same defect class as [BUG_20260909_a_saved_copy_of_a_bundled_driver_shares_its_favourite_key_so_one_star_stars_both.md](http://localhost:8000/winisd/openisd/bugs/BUG_20260909_a_saved_copy_of_a_bundled_driver_shares_its_favourite_key_so_one_star_stars_both.md?html) — that file's Cause/Evidence are now stale (it predates `driverId()` moving to uuid-based identity) and has been updated alongside this one.

## Symptom
In the driver selector/library, "My Drivers" has a cloned copy of a bundled driver
("Accuton Copy of AS168-9-470" alongside the bundled "Accuton AS168-9-470"). Setting
the favourite (★) on one of the two also highlights the star on the other — they are
supposed to be independent entries.

## Evidence
John's own screenshot of the two rows (Accuton "Copy of AS168-9-470" and Accuton
"AS168-9-470", each with their own ★/✎/✕ / "Manu ↗" row) — favouriting one highlights
both.

Favourites are keyed purely on the driver's own record uuid:
[driverBrowsingState.ts:54-57](http://localhost:8000/winisd/openisd/packages/ui/src/logic/driverBrowsingState.ts#L54-L57):
```
function driverId(d: OpenISDDriver): string {
  return d.uuid();
}
```
used by `isFavorite`/`toggleFavorite` ([driverBrowsingState.ts:239-248](http://localhost:8000/winisd/openisd/packages/ui/src/logic/driverBrowsingState.ts#L239-L248)).

**John's theory — copy shares the bundled driver's uuid — does NOT match current
source, checked just now:**
`cloneDriver()` ([driverBrowsingState.ts:484-489](http://localhost:8000/winisd/openisd/packages/ui/src/logic/driverBrowsingState.ts#L484-L489))
calls `d.detach()` then `copy.renameToCopy()`, and `renameToCopy()`
([openisdDomain.ts:1449-1456](http://localhost:8000/winisd/openisd/packages/design/domain/openisdDomain.ts#L1449-L1456))
explicitly mints a fresh uuid on the copy:
```
renameToCopy(): void {
    this.model.set('Copy of ' + (this.model.get().value ?? ''));
    const copy = this.cloneDriver();
    copy.uuid = { value: newUuid() };
    this.record.set(copy);
}
```
So on paper the two records get distinct uuids before the copy is even saved via
`myDriverRepo.upsert(copy)`.

## Cause
CONFIRMED — but not on the "Clone driver" button path John's evidence named. That path
(`cloneDriver()` → `renameToCopy()`) does mint a fresh uuid, and a Playwright test proving it
(`packages/ui/test/persistence/my-drivers.browser.spec.ts` — "cloning a library driver does not
link its favourite star to the original") passes on current source.

The real path is the pencil **Edit** button on a bundled driver's preview
([DriverLibrary.vue:245](http://localhost:8000/winisd/openisd/packages/ui/src/ui/components/DriverLibrary.vue#L245)),
which opens `editOverviewDriver()`
([driverSelection.ts:167-174](http://localhost:8000/winisd/openisd/packages/ui/src/logic/driverSelection.ts#L167-L174)).
That calls `d.detach()`, which preserves the source's record uuid, then on OK
`DriverEditorModal.vue`'s `confirmSaveToMyDrivers()` saved the draft into My Drivers via
`myDrivers.upsert(draftDriver.value)` with **no identity reassignment**
([DriverEditorModal.vue:435-440](http://localhost:8000/winisd/openisd/packages/ui/src/ui/components/DriverEditorModal.vue#L435-L440), pre-fix).
`upsert()` mints a fresh STORAGE-SLOT uuid, so the new My Drivers row looks independent — but
the driver's own record uuid, which `driverId()`
([driverBrowsingState.ts:56](http://localhost:8000/winisd/openisd/packages/ui/src/logic/driverBrowsingState.ts#L56))
reads for favourites, was carried over unchanged from the bundled original. Two rows, one
favourites key.

The same gap existed in `saveAsCopy()` (the rename-question's "Save as copy" button) and in
`confirmSaveToMyDrivers()`'s explicit "Save As Copy" branch (`isCopyAction`) — neither reassigned
the record uuid either, both were driven by the same wrong belief recorded in an old comment:
"a driver carries none [identity]" — false; `OpenISDDriver.uuid()` is real and is exactly what
favourites use.

## Fix
Mint a fresh record identity with `OpenISDDriver.copyAsNew()` (new uuid, no rename — the
existing primitive built for "a driver crosses into a new owner") at every save that is NOT a
true in-place edit of the exact My Drivers entry the editor was opened on:
- `saveAsCopy()` — [DriverEditorModal.vue:115-121](http://localhost:8000/winisd/openisd/packages/ui/src/ui/components/DriverEditorModal.vue#L115-L121)
- `confirmSaveToMyDrivers()`'s copy branch — [DriverEditorModal.vue:425-431](http://localhost:8000/winisd/openisd/packages/ui/src/ui/components/DriverEditorModal.vue#L425-L431)
- `confirmSaveToMyDrivers()`'s plain-save branch, now gated on `savedEntryForSubject() == null`
  (no backing My Drivers entry — a bundled-driver overview edit, or a brand-new driver) —
  [DriverEditorModal.vue:435-444](http://localhost:8000/winisd/openisd/packages/ui/src/ui/components/DriverEditorModal.vue#L435-L444)

`saveRenameInPlace()` is untouched — it is the one path that legitimately keeps the source's
identity (editing an existing My Drivers row in place).

## Verification
TDD, RED→GREEN:
- New test [my-drivers.browser.spec.ts:355](http://localhost:8000/winisd/openisd/packages/ui/test/persistence/my-drivers.browser.spec.ts?html#L355)
  — "editing a library driver's overview and saving to My Drivers does not link its favourite
  star to the original" — confirmed RED against pre-fix source (`fav-btn on` leaked onto the
  new entry), GREEN after the fix.
- Full file: `npx playwright test packages/ui/test/persistence/my-drivers.browser.spec.ts` — 12/12
  passed, including the pre-existing Clone-driver and Edit-flow tests (no regression).
- `npm run typecheck` — `ui` package clean (the `design` package's pre-existing, unrelated
  typecheck failure in `domain.test.ts` predates this session — see git status).
- `npx vitest run packages/design packages/persistence packages/ui/test/hooks/OgNewProject-hooks.test.ts`
  — 1728/1728 passed.
