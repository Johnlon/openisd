# The bridge derived nothing, so every generated .wdr lost its calculated fields

**Status:** FIXED (derivation), one field outstanding (`Dia`)
**Found:** 2026-09-02 by John, on seeing a regenerated ParState row with no `C` marks.

## Symptom

Every `winisd.wdr` produced by `driverYmlToOpenisdAndWdr` carried only the values its record
STATED. Every derivable field was written as its WinISD default and marked `N` — "not in play" —
so a reader of the file could not tell a field nobody knows from a field that follows from the
ones the record does state.

Measured on `packages/design/test/winisd/fixtures/openisd/e150he-44.openisd.yml`:

    before   ParState=EEEEEENNEENEEEENEENENNNENNNNNNNNNNNNNNNNNNNNENNCC     E:17 C:0  N:31
    after    ParState=EEEEEENNEENEEEECEECENCCENNCCCNNNCCCCNCNNNNNNENNCC     E:17 C:14 N:18

Fourteen fields per record — `Vd`, `EBP`, `no`, `SPLmax`, `USPL`, `Rme`, `Mpow`, `Mcost` among
them — were absent from every file. **All 1986 `.wdr` generated on 2026-09-01 have this.**

## Cause

`docs/design/WDR_LOGIC.md` states the rule for a ParState field:

    entered   -> value, mark E
    derivable -> calculated value, mark C
    otherwise -> 0, mark N

`cellsFrom` in `packages/design/winisd/driverYmlToOpenisdAndWdr.ts` implemented the first and the
last. It read each `.wdr` key's `FieldHandle`, wrote the value when the record stated one, and
skipped the key otherwise — `toWdrIni` then wrote the default and `#parState()` marked it `N`. The
middle rule had no code at all: the solver was never called.

The old `packages/model` path did call it, which is why this only appeared once the bridge became
the one writer.

## Fix

`cellsFrom` now solves before returning:

```ts
const solved = engine.solveConsistencyGroup(driver.fields());
for (const [quantity, value] of Object.entries(solved)) {
    if (typeof value !== 'number' || !isFinite(value)) continue;
    const key = quantity.split('_')[0];
    if (cells.has(key) || !INI_ROWS.includes(key)) continue;
    cells.set(key, {value: String(value), state: 'calculated'});
}
```

A key the record states is never overwritten — an entered value is a fact, not a candidate for
re-derivation.

## Still outstanding

`Dia` is derivable — `Dia = 2·√(Sd/π)` — and `solveConsistencyGroup` has no relation for it, so it
remains `0`/`N`. The solver relates `Sd <-> Dd` by that same formula but never `Sd <-> Dia`.
Adding the relation is a change to calculation logic and needs John's approval
(`AGENTS.md` §"Calculation logic — permission gate").

`packages/design/test/winisd/openisdToWdr.test.ts` "calculates every derivable field rather than
leaving it at its default" fails on exactly that one field, and is the gate for this bug.

## Verification when the corpus is regenerated

- A record's `.wdr` ParState carries `C` marks, not only `E` and `N`.
- `npx vitest run packages/design/test/winisd/openisdToWdr.test.ts` — 16/16.
- Every `.wdr` on disk needs regenerating: the 1986 written on 2026-09-01 all lack these fields.
