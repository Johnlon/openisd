# The My Passive Radiators library stores five loose numbers instead of a radiator record

Status: RESOLVED — saved passive radiators now use the common record/envelope repository path.

## Symptom

A radiator saved to the user's library is not the same kind of thing as a radiator from the
bundle. Saving one keeps five numbers and a name; everything else about it — brand, model,
provenance, which values were entered versus calculated, every spec outside those five — is
discarded at save time and cannot be recovered.

The equivalent is not true of drivers: a saved driver keeps its whole record.

## Evidence

- `packages/persistence/src/repos/myPassiveRadiatorRepo.ts:12-21` — the stored shape is
  `PRLibEntry { id: number; name: string; prSd; prMmd; prCms; prRms; prXmax; savedAt: string }`.
  Five sweep parameters, a display name, a timestamp id.
- `:24` — `PRSaveParams` is `Pick<SweepParams, 'prSd'|'prMmd'|'prCms'|'prRms'|'prXmax'>`, so
  `save()` is handed only those five and never sees a radiator.
- `packages/design/domain/openisdDomain.ts:1649` —
  `OpenISDPassiveRadiatorStandalone.fromConformingRecord(record, engine)` exists and is exported,
  and the bundled radiator repo goes through it. The library does not.
- `packages/persistence/src/repos/myDriverRepo.ts:43` — the driver library stores
  `StoredDriverEntry { uuid: string; record: unknown }`, the driver's own record wrapped with a
  repo-minted uuid.
- `packages/persistence/src/repos/bundledPassiveRadiatorRepo.ts:16-29` — the BUNDLED radiator
  repo validates the record correctly through `fromConformingRecord` and then flattens it into a
  `BundledPassiveRadiator` DTO of twelve loose fields, discarding the live object.
- `packages/persistence/src/repos/driverRepo.ts:117` — the bundled DRIVER repo returns
  `OpenISDDriver[]`, live domain objects. Its own docstring at `:147` records the governing
  ruling: "THE REPO NEVER READS A DRIVER FIELD (John, 2026-09-05 ruling)... any summary column a
  caller needs is that caller's job, reading the SAME domain object this function returns."
  `bundledPassiveRadiatorRepo` breaks that ruling; `driverRepo` is the one that obeys it.

Four repos over two kinds of thing, four unrelated shapes.

Also wrong, and part of the same shape: `PRLibEntry.id` is `Date.now()`
(`myPassiveRadiatorRepo.ts:46`) — two radiators saved in the same millisecond collide, and a
timestamp is not an identity. `myDriverRepo` mints a uuid for exactly this reason.

## Cause

The radiator library was built against the sweep-parameter object the tuning panel already had,
rather than against the radiator record the domain defines. The driver library was built the
other way round and the two never converged.

## Fix

All four repos converge on what `driverRepo` already does. John, 2026-09-09: "its 4 repos
myDriver myPR bundled pr bundled driver << all same schema", and "the envelope is new but the
baggage is common".

**The two saved libraries** share one envelope, differing only in what `record` holds:

    { schema: number, entries: [{ uuid: string, record: <the thing's own record> }] }

`record` is validated by the domain's own seam — `OpenISDDriver.fromConformingRecord` for
drivers, `OpenISDPassiveRadiatorStandalone.fromConformingRecord` for radiators — so neither repo
names a schema or asserts a shape. The uuid stays outside the record, as it already does for
drivers (an id inside the record could leak into a file export), and replaces the `Date.now()`
id.

**The two bundled repos** both return live domain objects: `bundledDrivers(): OpenISDDriver[]`
as today, and `list(): OpenISDPassiveRadiatorStandalone[]` in place of the DTO. The
`BundledPassiveRadiator` interface goes, and every field its callers read comes off the radiator
instead — the 2026-09-05 ruling applied to radiators as it already is to drivers.

The PR library therefore stores a real radiator record. `PRLibEntry` goes.

No migration (John: "no migration - as there is no user").

This also removes seven casts the no-casts gate currently lists: `myDriverRepo.ts:106,110,111,142,143,156`
and `myPassiveRadiatorRepo.ts:39`.

## Verification

Not yet fixed.
