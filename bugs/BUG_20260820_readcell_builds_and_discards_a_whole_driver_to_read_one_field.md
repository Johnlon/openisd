Status: OPEN

# `readCell` builds an entire `OpenISDDriver` to read ONE field, then throws it away

## Symptom

`packages/model/src/openisdDriver.ts:717`:

```ts
export function readCell(record: _OpenISDDriverJson, field: SpecField): Cell {
  return OpenISDDriver.fromRecord(record).cell(field);
}
```

`readMetaCell` (:722) is the same shape. Each call constructs the full driver — including its
`#displacedMeta` Map and `#listeners` Set — resolves ONE field, and drops the instance. The
memoised solve `#cache` that `cell()` populates is discarded with it, so **nothing the object
computes can ever persist**. The next field asks for the same driver to be built again.

## Evidence

The driver's own state, `openisdDriver.ts:147-167`: `#record`, `#section`, `#displacedMeta =
new Map()`, `#cache` (memoised `{ fields: Record<string, number>; errors }`), `#issues`,
`#autoCalculate`, `#listeners = new Set()`. `#cache` exists precisely so a solve is computed
once per driver — this function guarantees it is computed once per FIELD READ instead.

Measured call density:

- `packages/ui/src/db/driverRepo.ts:474` — `const num = (field) => readCell(rec, field).value`,
  then five calls (`Fs`, `Sd`, `Re`, `Znom`, `Pe`) per bundled row, plus `myDriverName(rec)` →
  `readDisplayName(rec)`. **Five driver constructions per catalogue row.**
- `packages/ui/src/db/driverRepo.ts:193-200` — same five for a My Drivers row.
- `packages/ui/src/ui/components/DriverBrowserWinisd.vue:165,167,168,169,170` — the template
  calls `myDriverEntry(d)` **five separate times per row**, and each of those runs the five
  `readCell`s above. **≈25 driver constructions per My Drivers row, per re-render**, none
  memoised.

With 1,526 bundled drivers, listing the catalogue is ~7,600 construct-solve-discard cycles.

## Cause

A free function taking a RECORD, offering the convenience of reading a field without holding a
driver. The convenience is the defect: it makes the expensive object disposable, so callers
never hold one, so the memoisation designed into the class can never do its job. It also hands
the caller a way to work in terms of the private JSON shape instead of the domain object —
which is how `_OpenISDDriverJson` reached `driverRepo`, `myDrivers`, `driverLibrary` and
`driverSelection` in the first place.

## Fix

Not fixed. `readCell`/`readMetaCell`/`readDisplayName` are DELETED. Callers hold an
`OpenISDDriver` and call `.cell()`/`.metaCell()` on it — constructed once, retained for as long
as it is being read, with its memoised solve doing the job it was written for. This is objective
4 of the QO60/QO61 plan; deleting these three functions also removes `_OpenISDDriverJson` from
the four `ui/` files above at the same time.

## Verification

N/A — open. Afterwards: no free function in `@openisd/model` takes a `_OpenISDDriverJson` and
returns a resolved value, and a catalogue listing constructs exactly one driver per driver.
