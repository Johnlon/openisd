Status: RESOLVED (2026-08-22, task A7)

# `driverHasDqIssues` throws on a My Drivers record with no `quality` block, blanking the picker

## Symptom

Every test in `packages/ui/test/db/driver-selection.browser.spec.ts` that opens the picker and
looks for the seeded My Drivers row (`.my-ditem` filtered on `PICKED`) times out — the row never
appears. Reproduced running the full spec (`bash scripts/test-browser.sh
packages/ui/test/db/driver-selection.browser.spec.ts --workers=1`): every test whose `beforeEach`
seeds `openisd_my_drivers` fails identically.

## Evidence

The spec's `beforeEach` (`driver-selection.browser.spec.ts:19-26`) seeds `localStorage` with a
flat legacy shape:

```js
localStorage.setItem('openisd_my_drivers', JSON.stringify([{
  name, brand: 'Spec', model: 'Fixture',
  Fs: 41, Qts: 0.35, ..., _savedAt: 1,
}]));
```

`myDrivers.ts::list()` reads this with no validation — `JSON.parse(...) as
_OpenISDDriverJson[]` — so the object flows straight into `driverLibrary.ts`'s `myDrivers` ref
and on to `driverHasDqIssues` with `record.quality === undefined` (the fixture carries no
`quality` key at all).

Added to `driverRepo.ts::driverHasDqIssues` in this same task (A7, disposition-derivation fix):
`!recordStandingIsOk(record.quality)`. `recordStandingIsOk` (`packages/model/src/driverStanding.ts`)
reads `evidence.missing.length` unconditionally — `record.quality` being `undefined` throws
`TypeError: Cannot read properties of undefined (reading 'missing')` inside the row's render,
which is consistent with the picker showing no row for the fixture at all.

## Cause

`_OpenISDDriverJson.quality` is a required field in the TYPE, but `myDrivers.ts::list()`'s
`JSON.parse(...) as _OpenISDDriverJson[]` is an unchecked assertion over browser-storage data —
exactly the same class of gap `driverRecordProblems()` exists to catch for other malformed
blobs (`openisdDriver.ts`'s own doc comment: "a blob arriving from localStorage... is data
someone else wrote... and `x as _OpenISDDriverJson` is an assertion, not a check"). Nothing
calls `driverRecordProblems()` (or an equivalent) before this fixture reaches
`driverHasDqIssues`, so the new unconditional `.missing`/`.parse_errors` read is the first thing
in the whole render path that dereferences `quality` without a presence check.

## Fix

REVISED (orchestrator adjudication, same session): the first fix
(`record.quality ? recordStandingIsOk(record.quality) : true` in `driverRepo.ts`, and a
matching `?? []`-defaulted `recordStandingIsOk` in `packages/model/src/driverStanding.ts`) was
itself a one-model violation — `quality` and its `missing`/`parse_errors` lists are REQUIRED
fields of `_OpenISDDriverJson`, so tolerating their absence at the derivation call site
fabricates "no problems" from a record that is actually INVALID (the `_coerce_flat_fields`
precedent: delete the tolerance, don't adapt to it). Both defensive branches are deleted;
`recordStandingIsOk`/`driverHasDqIssues` are strict again and throw on a non-conforming record,
which is the CORRECT behaviour for data that should never reach them.

The actual fix is at the SEAM: `myDrivers.ts::list()` (`createMyDriverRepo`) now validates
every record it reads out of browser storage — `isConformingRecord()` combines
`driverRecordProblems()` (catches an absent `specs`) with a check that `quality.missing` and
`quality.parse_errors` are both present arrays. `list()` never hands a failing record to the
model: it reads through `readAndSplit()`, which partitions the stored array into `conforming`
(what `list()` returns) and `unrecognised` (everything else), logging each refusal once —
`console.warn('my-drivers: ignoring non-conforming stored record', driverRecordProblems(candidate), candidate)`.

**REVISED again (orchestrator ruling, same session, QO81 filed for John, pending
ratification): a refused record is NOT erased.** The first version of this fix routed
`upsert`/`remove` through the filtered `list()`, so writing back the filtered result silently
dropped any non-conforming entry already in storage — this key holds the USER's own saved
data, and erasing an entry nobody asked to delete is a worse failure than a row that fails to
display. `upsert`/`remove` now read the raw stored array via the same `readAndSplit()`, apply
their operation only to the `conforming` subset, and write back `[...conforming,
...unrecognised]` — each group keeping its own relative order, the unrecognised blobs carried
through completely untouched. They are never loaded into the model (still refused by
`isConformingRecord`) and never deleted.

## Verification

`npx vitest run packages/ui/test/db/myDrivers.test.ts` — 6/6 pass: the 4 `list()`-filtering
cases (a mixed stored list returns only the valid record; `driverHasDqIssues` over the
filtered result does not throw; an all-invalid list returns empty; an all-valid list returns
every record) plus 2 preservation cases written red-first — `upsert` on a store holding one
legacy blob + one valid record writes the new record while the legacy blob and the existing
valid record both survive untouched in storage; `remove` on the same store drops only the
identified valid record and leaves the legacy blob in place. `npx vitest run
packages/model/test/driverStanding.test.ts packages/ui/test/db/bundle-drivers-disposition.test.ts
packages/ui/test/db/driver-has-dq-issues.test.ts` — all pass with the tolerance-encoding cases
deleted (they tested the retired shape, not the fixed behaviour). `npx tsc -p packages/model
--noEmit` / `npx vue-tsc -p packages/ui --noEmit` clean. `npx vite-node
scripts/bundle-drivers.mjs` over the full 1969-record live corpus: 1197 bundled (the
then-current interim standing-based gate, since superseded — see
`bugs/BUG_20260822_openisd_reads_disposition_which_post_b10_records_no_longer_carry.md`'s
composition-delta section for the current 1969/1969 count), no throw (`quality` genuinely is
mandatory in every emitted record) — output `drivers-bundle.json` byte-identical (md5
`e6628ce2f8b01542cf48362e2f39054d`) before and after the strictness change.
`bash scripts/test-browser.sh packages/ui/test/db/driver-selection.browser.spec.ts --workers=1`
— see `bugs/BUG_20260822_driver_selection_spec_seeds_a_flat_shape_myDrivers_no_longer_tolerates.md`
for the post-fix behaviour of that spec (out of A7 scope to rewrite).
