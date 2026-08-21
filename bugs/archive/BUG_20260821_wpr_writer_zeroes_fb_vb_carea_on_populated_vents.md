Status: RESOLVED

# `toWpr` writes `Fb=0`/`Vb=0`/`carea=0` for every populated vent, even where WinISD's own goldens carry real values

## Symptom

`ventSection()`'s populated-vent branch in `packages/winisd/src/classic/wpr.ts` hardcoded
`Fb=0`, `Vb=0`, `carea=0` for every real vent it wrote. The parity corpus has real vents with
non-zero `Fb`/`Vb`/`carea`.

## Evidence

`packages/winisd/test/fixtures/winisd-parity/goldens/`, `[Box]` vs. the populated vent's own
section:

| golden | `[Box]` tuning (chamber the vent belongs to) | populated vent | match |
|---|---|---|---|
| `vented-small.wpr` | `Vr=0.02` `Fr=45` (rear) | `[VentRear]` `Vb=0.02` `Fb=45` | exact |
| `bandpass4.wpr` | `Vf=0.035` `Ff=60` (front) | `[VentFront]` `Vb=0.035` `Fb=60` | exact |
| `vented-b4.wpr` | `Vr=0.035` `Fr=36` (rear) | `[VentRear]` `Vb=0.035` `Fb=36` | exact |

All three match: `Fb`/`Vb` are a redundant copy of the `[Box]` tuning/volume of whichever
chamber the vent is attached to (`VentFront` ↔ `Vf`/`Ff`, `VentRear` ↔ `Vr`/`Fr`), not
independent per-vent state. `carea = π·(dia1/2)²` also confirmed: `dia1=0.06 → 0.00282743…`,
`dia1=0.075 → 0.00441786…` in all three goldens.

`carea`'s single source is `ventArea_m2()` in `packages/model/src/openisdProject.ts:321`
(consolidated there by
`bugs/BUG_20260818_vent_area_formula_duplicated_four_times_no_engine_source_of_truth.md`).
`packages/winisd` carries no runtime dependency on `@openisd/model` (`packages/winisd/package.json`
— `@openisd/model` is a devDependency only, for tests), so the derivation cannot live inside
`toWpr()`/`ventSection()`: the caller (`packages/ui/src/logic/wprMapping.ts`) already computes
this value as its `ventArea_m2` parameter and was already passing it into `WprBox.SdFront`/
`SdRear` — `carea` reuses that SAME value, not a second computation.

## Cause

`WprVent` declared no `Fb`, `Vb`, or `carea` field, so no caller could supply them — the
zeroing was not a wrong default overriding a caller value, it was the only value the interface
allowed.

## Fix

`packages/winisd/src/classic/wpr.ts`: `WprVent` gained `Fb`, `Vb`, `carea: number` — REQUIRED,
not optional (an optional field paired with `num()`'s absent→`'0'` collapse would let a caller
omit them and silently re-emit the exact defect this bug reports; there is no evidenced WinISD
default for a real vent's tuning/volume/area the way `endCorrection` has 0.6, so the type error
forces every call site to supply its own chamber's numbers). Documented as the owning chamber's
tuning/volume/area — no second source of truth. `ventSection()`'s populated branch now writes
`num(v.Fb)`/`num(v.Vb)`/`num(v.carea)` instead of literal `0`.

`packages/ui/src/logic/wprMapping.ts`: `ventRear` is built with
`Fb: input.box.Fr, Vb: input.box.Vr, carea: Sp` (the same values just written to
`input.box.Fr`/`Vr`/`SdRear`); `ventFront` is built with `Fb: input.box.Ff, Vb: input.box.Vf,
carea: Sp` (the same values just written to `input.box.Ff`/`Vf`/`SdFront`).

## Verification

`packages/winisd/test/classic/wpr.test.ts` — 3 new whole-block (`extractSection`) equality
tests added, one per golden (`vented-small`, `bandpass4`, `vented-b4`), asserting the populated
`[VentRear]`/`[VentFront]` block matches the golden byte-for-byte. `Fb`/`Vb` are proven exactly
right — they are plain integers/short decimals in the corpus (45, 0.02, 60, 0.035, 36) with no
floating-point formatting divergence to hide. `carea` is currently fed into each test as the
golden's OWN printed literal (e.g. `0.00282743338823081`), not derived in the test from the
scenario's `dia` via `ventArea_m2()`/`Math.PI` — doing that derivation in JS produces
`0.0028274333882308137`, which does not match the golden byte-for-byte
(`bugs/BUG_20260821_wpr_float_formatting_diverges_from_winisd_15_digits.md`, OPEN). So `carea`'s
test coverage here proves the writer passes a supplied value through unchanged; it does not yet
prove the production derivation (`wprMapping.ts`'s `Sp` → `WprVent.carea`) reproduces WinISD's
own `carea` byte-for-byte — that is blocked on the float-formatting bug above being resolved.

Red before the fix (hardcoded `0` vs. golden's real values), green after:

```
✓ |winisd| test/classic/wpr.test.ts (17 tests)
✓ |ui| test/logic/wprMapping.test.ts (1 test)
```

`npx tsc --noEmit -p packages/winisd` clean.
