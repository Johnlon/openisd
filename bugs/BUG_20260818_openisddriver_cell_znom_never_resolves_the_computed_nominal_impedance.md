# `OpenISDDriver.cell('Znom')` never resolves the engine's computed nominal impedance

## Status
OPEN 2026-08-18 — found while implementing QO55's `WinISDDriver.fromOpenISDDriver` pure-getter
rewrite (`.cell()`-only, no `.toRecord()`), which surfaced that `cell()` cannot answer 'Znom'
correctly for an unentered driver.

## Symptom

`OpenISDDriver.cell('Znom')` returns `{value: null, state: 'N'}` for a driver whose Znom was
never manually entered, EVEN WHEN the engine has computed one from `Re`
(`packages/engine/src/driver.ts:352-353`, `r.Z = nominalImpedance(r.Re)`).

## Cause

`packages/model/src/openisdDriver.ts`'s `TO_ENGINE`/`FROM_ENGINE` join maps a record's own
field spelling to the engine's internal spelling wherever they differ — the same mechanism
already correctly handles `BL` ↔ `Bl` (`TO_ENGINE.BL = 'Bl'`, `FROM_ENGINE.Bl = 'BL'`) and every
mm-dimension field (`Hc_mm` ↔ `Hc`, etc.). The engine's own derived-field name for impedance is
`Z` (`driver.ts:352`, `r.Z = ...`), but the record's own field name is `Znom`
(`SPEC_TO_WDR`/`_SpecSection` both spell it `Znom`) — and this ONE pair is missing from
`TO_ENGINE`/`FROM_ENGINE`. `cell()`'s computed branch does
`this.#derived().fields[engineName(field)]`; `engineName('Znom')` falls through to `'Znom'`
itself (no `TO_ENGINE` entry), but `#derived().fields` only ever contains a key `'Z'`, never
`'Znom'` — so the lookup always misses and `cell('Znom')` reports `N` regardless of whether the
engine actually derived a value.

This gap was previously masked: the pre-rewrite `WinISDDriver.fromOpenISDDriver` (and its
predecessor `fromOpenISDRecord`) bypassed `OpenISDDriver.cell()` entirely, calling
`deriveOpenISDFields()` directly on a flattened record and doing its OWN `Znom → Z` input
remap plus a `DERIVED_TO_WDR: { Z: 'Znom' }` output remap — duplicating exactly the join that
belongs in `TO_ENGINE`/`FROM_ENGINE`, and hiding this bug from every caller that goes through
`OpenISDDriver.cell()` directly (the Tune panel's `driverCell('Znom')`, the driver editor, etc.)
rather than through the old bypass.

## Fix

Add the missing pair, matching the existing `BL`/`Bl` pattern exactly:
```ts
const TO_ENGINE: Partial<Record<SpecField, string>> = {
  BL: 'Bl',
  Znom: 'Z',
  ...
};
const FROM_ENGINE: Record<string, SpecField> = { Bl: 'BL', Z: 'Znom' };
```

## Verification

Not yet — fix being applied in the same change as the QO55 rewrite; `winisd-parity.test.ts`'s
Znom-column comparisons are the fidelity proof once both land.
