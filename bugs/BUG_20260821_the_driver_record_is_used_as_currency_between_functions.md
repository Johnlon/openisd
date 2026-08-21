Status: OPEN

# The driver RECORD is passed between functions as currency, not written to a file

## Symptom

`toJsonRecord()` has seven production call sites. Only one is serialising to a file. The other
six hand the record from one function to another as the working representation of a driver —
which is how `_OpenISDDriverJson` reached `driverSelection.ts`, `myDrivers.ts`, `store.ts` and
`DriverEditorModal.vue` in the first place.

## Evidence

Every production call, 2026-08-21:

| Site | What it does | Serialising? |
|---|---|---|
| `logic/useDesignIO.ts:160` | `JSON.stringify(record)` into a `.owdr` download | **yes** — legitimate |
| `logic/driverSelection.ts:117` | `return { ok: true, record: driver.toJsonRecord() }` | no — a resolved driver returned as its record |
| `logic/driverSelection.ts:135` | `OpenISDDriver.fromWdrText(text).toJsonRecord()` | no — parse then immediately flatten |
| `logic/store.ts:405` | `managedProject.loadDriverRecord(OpenISDDriver.fromWdrText(text).toJsonRecord())` | no — construct a driver, discard it, pass its record |
| `logic/useDesignIO.ts:218` | `.wdr` inside a `.wpr` → `toJsonRecord()` | no — same pattern |
| `ui/components/DriverEditorModal.vue:333` | `myDrivers.upsert(draftDriver.value.toJsonRecord())` | no — repository takes a record |
| `ui/components/DriverEditorModal.vue:339,387` | `acceptDriverEdit(draftDriver.value.toJsonRecord())` | no — accept path takes a record |

`store.ts:405` is the clearest: it builds an `OpenISDDriver` from `.wdr` text purely to take its
record away and throw the driver out — then `ManagedOpenISDProject` reconstructs one from that
record (`managedProject.ts:116`).

The same shape drives the `.wdr`/`.owdr` text methods: `toWdrText()`/`toOwdrText()` have three
call sites and all three ARE writing bytes to a file or download, so those are used correctly.
The record is the one that leaks.

## Cause

A record crosses a function boundary more easily than a class instance — `structuredClone` keeps
it, it is trivially comparable, and it needs no import. So it became the default currency, and
each function that accepts one has to name `_OpenISDDriverJson` to type its parameter. That
naming is what every current private-import offence in `architecture.test.ts` reports.

## Fix

Not fixed. RECORDS cross the persistence boundary; DRIVERS cross function boundaries. Concretely:

- `managedProject.loadDriverRecord(record)` gains/becomes `loadDriver(driver: OpenISDDriver)`;
  `store.ts:405` passes `OpenISDDriver.fromWdrText(text)` whole.
- `driverSelection`'s `SelectionResult` carries a driver, not a record.
- `myDrivers.upsert()` takes a driver and calls `toJsonRecord()` ITSELF at the storage boundary,
  where flattening is correct.
- `acceptDriverEdit()` takes the draft driver.

That removes `_OpenISDDriverJson` from four of the six files the private-import gate currently
names, without any allow-list entry.

Part of objectives 2 and 4 of `docs/plans/PLAN_QO60_LAYERING_REMEDIATION.md`; recorded
separately because it is a distinct, testable defect from the store-globals work.

## Verification

N/A — open. Afterwards: `toJsonRecord()` is called only where the result is immediately
serialised to text or written to storage, and no function signature in `logic/` or `ui/` names
`_OpenISDDriverJson`.
