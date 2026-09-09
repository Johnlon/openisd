# My Drivers specs seed the pre-migration localStorage shape, so no saved driver ever loads

Status: OPEN

## Symptom

53 of 62 tests in `packages/ui/test/persistence` fail, concentrated in the specs that need a
SAVED driver on screen:

```
16  driver-selection.browser.spec.ts
12  driver-summary-winisd.browser.spec.ts
12  driver-scope-chip.browser.spec.ts
 7  my-drivers-failures.browser.spec.ts
 4  driver-search-interactive.browser.spec.ts
 2  driver-favorites.browser.spec.ts
```

The split inside `driver-scope-chip.browser.spec.ts` names the cause exactly — the three tests
that touch only bundled drivers pass, and the failures begin at the first test that needs a
saved one:

```
✓   9 all three scopes are shown at once, and exactly one is highlighted
✓  10 a click rotates the highlight Bundled → My Drivers → All
✓  11 Bundled + Favorites off — bundled drivers, and no saved ones
✘  12 My Drivers + Favorites off — the saved drivers, and nothing bundled
```

The run was server-clean, so these are real:

```
$ grep -c ERR_CONNECTION_REFUSED <run output>
0
```

## Cause

The specs seed the bucket with a bare array of flat driver literals — the shape My Drivers used
before the model→design migration:

```ts
// packages/ui/test/persistence/driver-scope-chip.browser.spec.ts:41-44
const MY_DRIVERS = [
  { brand: 'Scope Test', model: 'Alpha', Fs: 40, Re: 6.2, Sd: 0.02, Qts: 0.4, Qes: 0.5, Qms: 3 },
  { brand: 'Scope Test', model: 'Beta',  Fs: 55, Re: 6.4, Sd: 0.015, Qts: 0.42, Qes: 0.52, Qms: 3.2 },
];
await page.addInitScript((drivers) => {
  localStorage.setItem('openisd_my_drivers', JSON.stringify(drivers));
}, MY_DRIVERS);
```

`myDriverRepo` no longer reads that. The bucket is now a versioned, uuid-keyed envelope owned by
`savedEntries.ts`, and each record is opened through the domain:

```ts
// packages/persistence/src/repos/myDriverRepo.ts:55-61
const library: SavedEntries<OpenISDDriver> = createSavedEntries(storage, {
    key: MY_DRIVERS_KEY,
    schemaVersion: 1,
    open: (record) => OpenISDDriver.fromConformingRecord(record, engine),
    snapshot: (driver) => driver.cloneDriver(),
});
```

A flat `{brand, model, Fs}` literal is not an `OpenISDDeviceJson` record — the real record nests
values under `specs.<section>.<Field>.readings` with an `origin`, as
`packages/ui/test/fixtures/sample-project.owpr` shows. So every seeded entry fails to open, the
My Drivers section renders empty, and each assertion that a saved row exists fails.

This is the specs being stale, not the repo being wrong: the envelope and the uuid identity are
the migration's intended design.

## Impact

The whole My Drivers surface is untested — save, clone, delete, favourite, scope filtering,
search, and the broken-entry challenge flow. That surface is exactly where a silent data-loss
bug would live, since it owns the user's own saved work in browser storage.

It also hides whatever real defects sit behind these 53 reds: a genuine regression in the picker
is currently indistinguishable from the seeding failure.

## Fix

Seed through the same envelope the app writes, rather than hand-rolling a literal that mimics an
older format. Two candidates, and the first is better because it cannot drift again:

1. Drive the repo's own write path in the page — `myDriverRepo.upsert(driver)` — so the test
   stores whatever the current code stores. A seeding helper built on the app's own API stays
   correct across the next schema change.
2. Failing that, seed a record of the real shape (a full `OpenISDDeviceJson` device, as in
   `sample-project.owpr`) wrapped in the `savedEntries` envelope with its `schemaVersion`.

Whichever is used, it belongs in one place the six specs share — a fixture file or a helper that
writes storage — since six copies of a storage format is what produced six stale copies here.

Note the tension with the project's "tests construct their own data" rule: what is shared must be
the MECHANISM (how to seed), never the domain values the assertions depend on. Each spec keeps
declaring its own drivers.

## Verification

```
$ npx playwright test packages/ui/test/persistence packages/ui/test/db --workers=1
  53 failed
   9 passed
$ grep -c ERR_CONNECTION_REFUSED <run output>
0
```

Passing/failing split within `driver-scope-chip.browser.spec.ts` (bundled-only tests pass,
saved-driver tests fail) is the direct evidence for the cause above.
