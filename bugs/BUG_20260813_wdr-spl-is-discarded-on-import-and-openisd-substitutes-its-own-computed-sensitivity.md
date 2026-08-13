# A `.wdr`'s stated `SPL` is discarded on import; openisd substitutes its own computed sensitivity

**Found** 2026-08-13, bucketing `packages/winisd/test/winisd-parity.test.ts`.
**Severity** silent data loss on import — a datasheet figure the file states is thrown away and
replaced by a different number, with no signal to the user.

## Symptom

Parity scenario `sealed-small` (a driver defined by explicit numbers: Fs 37.2 Hz, Re 6.4 Ω,
Vas 0.0291887297703274 m³, Qes 0.41220376440829154, **SPL 90 dB**):

| | `SPL` | ParState slot 3 |
| --- | --- | --- |
| the input file (`scenarios.json` → `[Driver] SPL=90`) | `90` | — |
| WinISD 0.7.0.0 (`…/goldens/sealed-small.wpr`) | `SPL=90`, echoed unchanged | `E` |
| openisd `Driver.fromWdr(...).cell('SPL')` | `87.65068346041753`, state `C` | `N` |

2.35 dB of error on a stated field, and the app reports it as its own calculation.

The two numbers are not two estimates of one thing: WinISD carries a STATED reference
sensitivity beside an INDEPENDENTLY calculated η₀ (`no=0.00354497679893034` at slot 22 = `C`),
and the two need not agree — that is exactly how a real driver's datasheet SPL sits beside its
T/S-derived efficiency. openisd collapses them, so the datasheet number cannot survive.

## The code

`packages/winisd/src/parstate.ts:18-68` — `POS_TO_WDRKEY` records slot 3 as `SPL`.

`packages/winisd/src/parstate.ts:84-100` — `MODELED_SLOTS`, the 15 fields the Driver actually
reads from a file, **does not include slot 3**. `fromWdr` only replays E-marks for
`MODELED_SLOTS` (`driver.ts:331-336`), so `SPL=90` never reaches `#inputs`.

`packages/winisd/src/driver.ts:439` then fills the gap:

    if (r.SPL == null && r.no != null && r.no > 0) r.SPL = splFromEfficiency(r.no, r.roo, r.c);

With nothing entered, `r.SPL` is always this computed value.

## Evidence that WinISD treats `SPL` as an entered field

`drivers/sample/winisd/s-spl.wdr` — a WinISD-authored probe with `SPL=123` and every other
parameter 0. Its ParState is `NNNENNN…`: slot 3 is `E` and every derived slot is `N`. WinISD
never computed a sensitivity there; it recorded one that was typed.

Corroborated by the parity goldens, where slot 3 is `E` on all eight and the value is the
scenario's own input, while the derived slots (18 `Vd`, 21 `Dd`, 22 `no`, 26 `SPLmax`,
27 `SPLmaxLF`, 28 `USPL`, 32 `gamma`, 33 `EBP`, 34 `Rme`, 35 `Mpow`, 37 `Gloss`) read `C`.

## Root cause

`MODELED_SLOTS` was built for the T/S consistency group. `SPL` is not part of that group — it is
an independently stated figure of merit — so it was never added, and the only path by which a
file's value can become an `E` cell runs through that table.

## Fix

Add the slot to `MODELED_SLOTS`:

    { pos: 3,  wdrKey: 'SPL',  field: 'SPL' },

`fromWdr` then enters it (E), `#derive`'s `r.SPL == null` guard leaves it alone, `toWdr()`
overlays it back, and `#buildParState` marks slot 3 `E`. No formula changes.

## Verification

`packages/winisd/test/winisd-parity.test.ts` — the eight `SPL` rows go green, and ParState slot
3 stops mismatching. A dedicated regression test asserts `cell('SPL')` is `{state:'E', value:90}`
for a `.wdr` stating `SPL=90`.

## Adjacent, NOT fixed here

`SPL` and `SPLref` are two names for one quantity — reference sensitivity, 1 W at 1 m.
`ARCHITECTURE.md` §5 "One name per field" forbids that, and after this fix a `.wdr` that states
`SPL` leaves `cell('SPL') = 90` beside `cell('SPLref') = 87.65`. Collapsing them means renaming
across `@openisd/engine`'s solver, which is `docs/plans/OPENISD_TARGET_MIGRATION_PLAN.md`
Step 7's work, not this fix's.
