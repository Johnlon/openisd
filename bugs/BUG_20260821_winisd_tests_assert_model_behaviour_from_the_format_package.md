Status: OPEN

# Two `packages/winisd/test` files assert `@openisd/model` behaviour, mixing both objects per file

## Symptom

`wdr-import-fidelity.test.ts` and `wdr-model-coverage.test.ts` live in the format package's test
directory but spend much of their length asserting the MODEL's behaviour. Each file calls
`.cell()` on both a `WinISDDriver` and an `OpenISDDriver`, and nothing at the call site says
which object a given `cell()` belongs to.

## Evidence

`packages/winisd/test/wdr-import-fidelity.test.ts`:

- `:78` — `const cell = wdr.cell('Gloss')` — a `WinISDDriver` cell. Provenance is the `.wdr`
  ParState letter `'C'`.
- `:98` — `const cell = driverOf(SEALED_SMALL).cell('SPL')` — an `OpenISDDriver` cell.
  Provenance is `Provenance.Entered`.

Identical local variable name, identical-looking call, two different types, seven lines of a
comment between them.

`packages/winisd/test/wdr-model-coverage.test.ts`: `roundTripped.cell(...)` is a `WinISDDriver`
(`:86-89`, `:106-109`); `driver.cell(...)` is an `OpenISDDriver` (`:132-134`, `:141-144`). Its
own header states the subject plainly — *"every `.wdr` field has a home in the OpenISD model"* —
which is a claim about `@openisd/model`, tested from `packages/winisd`.

**Demonstrated cost, 2026-08-21.** Splitting `CellState` into `Provenance` (model) and the
`.wdr` letters (format) required converting every assertion by which object it read. These two
files were got wrong TWICE — first over-converted, then over-reverted — because the file gives a
reader no signal. Every other test file in the sweep converted correctly first time.

## Cause

The files are organised by the SCENARIO they exercise (importing a `.wdr`) rather than by the
UNIT under test. An import scenario legitimately touches both sides, so both ended up in one
file, in the package that owns only one of them.

## Fix

Not fixed. Split by which side each assertion exercises:

- format-fidelity assertions — the `.wdr` text parses to these cells with these ParState
  letters — stay in `packages/winisd/test`.
- model-coverage assertions — every `.wdr` key has a home in `OpenISDDriver`, an entered value
  survives the round trip, a cleared field reverts to a computed value — move to
  `packages/model/test`.

Where a test genuinely needs both objects (the round trip IS the subject), keep it in one place
but name the variables for their type — `wdrCell` / `driverCell`, never a bare `cell`.

## Verification

N/A — open. Afterwards: no test file calls `.cell()` on two different classes through
same-named variables, and no assertion about `@openisd/model`'s behaviour lives in
`packages/winisd/test`.
