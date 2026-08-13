# Xmax: an equal overhang writes 0 instead of falling through to Vd/Sd

**Found** 2026-08-13, by the WinISD route-precedence probe (ledger QO39, QO40).
**Severity** wrong number shown to the user, and a false excursion limit drawn on two charts.

## Symptom

A driver whose record carries `Hc == Hg` gets `Xmax = 0`, even when it also carries `Vd` and `Sd`
from which a real Xmax follows. The Excursion and Max-SPL charts then draw their limit line at
zero excursion.

## What WinISD does

Precedence between the two Xmax routes is on the **RESULT**, not on the route. WinISD prefers
`abs(Hc - Hg) / 2`, but an equal overhang makes that zero — which is not an excursion limit — and
it falls through to `Vd / Sd`.

Evidence: probe case G in `winisd_research/runs/xmax_route.jsonl`, driven against real WinISD
under wine. Case C (`Hc=0.0176, Hg=0.006, Vd=140e-6, Sd=0.0095`) confirms the ordinary precedence:
WinISD writes `0.0058` from row 19, not `0.0147` from row 20.

## Cause

`packages/engine/src/driver.ts` §7 guarded the first route only on `Xmax == null`, so an equal
overhang satisfied it and `setVal('Xmax', 0)` ran. `setVal` writes only into a still-null field,
so the `Vd / Sd` branch below was then skipped for ever — the zero blocked its own replacement.

## Fix

The first route additionally requires `Hc !== Hg`. An equal overhang produces no value, the field
stays null, and the `Vd / Sd` branch takes it.

## Verification

`packages/engine/test/advanced-figures.test.ts` — "Xmax route precedence is on the RESULT, not the
route": an equal overhang with `Vd`/`Sd` present resolves to `140e-6 / 0.0095`, and an unequal
overhang still beats `Vd/Sd` at `0.0058`. Both expected values are computed from the inputs, not
read back from the implementation. 27 tests pass.
