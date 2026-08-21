# BUG_20260805 — humidity and pressure inputs are collected, persisted, and then ignored

Status: RESOLVED

# Status
OPEN 2026-08-05 — resolved by 2026-08-20: `Params.humidityPct`/`pressurePa` exist
(packages/engine/src/types.ts:133,135), `OriginalShell.vue:676-682` wires `advHumidity`/
`advPressure` into `state.P`, and `sweep.ts:129` calls `airFor(P)` which consumes both
(air.ts:146-150) via the CIPM moist-air model. Not inert. `forceFlatResponse`-style opt-out
to WinISD's ignore-them behaviour also exists (types.ts ~137).


**Status:** OPEN — not yet fixed. Needs a design ruling before code (see "Why it was not
fixed on the spot").

## Symptom

The Advanced pane offers WinISD's three environment inputs — temperature, relative humidity,
air pressure — and the Options dialog persists all three. **Only temperature reaches the
engine.** Humidity and pressure land in local refs that nothing reads.

A user who sets humidity to 80 % sees the value accepted, stored, and reloaded next session,
and every computed number is identical to before. There is no signal that the input was
discarded. Two live inputs that visibly do nothing are worse than two absent inputs.

## The code

- Options dialog persists all three:
  `/home/john/work/winisd/openisd/packages/ui/src/store.ts:63`
- `advTemp` → `state.P.tempK` → the sweep:
  `/home/john/work/winisd/openisd/packages/ui/src/shells/original/OriginalShell.vue:558-559`
- `advHumidity`, `advPressure` → local refs, written nowhere:
  `/home/john/work/winisd/openisd/packages/ui/src/shells/original/OriginalShell.vue:560-561`
- `Params` carries only `tempK`:
  `/home/john/work/winisd/openisd/packages/engine/src/types.ts:183`
- The derived readout is `soundVelocity(tempK)` alone:
  `/home/john/work/winisd/openisd/packages/ui/src/shells/original/OriginalShell.vue:562`,
  `/home/john/work/winisd/openisd/packages/engine/src/formulas.ts:55-64`

Air density is not displayed at all. WinISD shows both sound velocity and air density.

## Why this is more than a dangling input

Humidity is precisely what makes WinISD's constants what they are. WinISD's defaults —
`c = 343.684120962152`, `ρ = 1.20095217714682`, written into all 1624 WinISD-authored `.wdr`
files in this workspace — reproduce from T = 293.15 K, **RH = 30 %**, p = 101325 Pa to within
3–5 ppm on both constants simultaneously. The dry-air textbook figures are 343.2 and 1.204;
the entire gap is humidity.

So openisd hardcodes the *result* of a 30 % RH assumption while offering the user a humidity
box that cannot change it. The one input that would justify the constants is the one that is
inert.

`formulas.ts` also scales both constants by temperature alone (`c ∝ √T`, `ρ ∝ 1/T`), which is
correct physics for fixed composition but silently wrong the moment humidity is meant to
matter.

## Root cause

The engine's `Params` type never gained the two fields. The UI was built to WinISD's pane
layout, which has three inputs, so the controls exist ahead of the model that would consume
them. Nothing failed, because an unread local ref is not an error in any checker.

## Why it was not fixed on the spot

Two defensible fixes and the choice is the human's:

1. **Extend the model** — add `humidityPct` and `pressurePa` to `Params`, derive `c` and `ρ`
   from all three via the moist-air formulation, and surface air density beside sound
   velocity. This changes computed numbers for any project not at 30 % RH / 101325 Pa, so
   every golden fixture moves and needs regenerating against a stated reference.
2. **Mark both inputs visibly inert** — the shell already has a pattern for this. No number
   changes; the user simply learns the truth.

Option 1 is the larger and more correct change and must not be taken silently, because it
moves every golden. `winisd_research/GAPS.md` §A6 recommends either, and explicitly warns
**do not re-open the constants** — `RHO` and `C` already match WinISD exactly.

## **Evidence (artifact checked this session):**

`sed -n '225,260p' /home/john/work/winisd/winisd_research/GAPS.md` run 2026-08-05, which is
§A6 "Humidity and air pressure are collected but never reach the engine", quoted above with
its file-and-line citations for `store.ts:63`, `OriginalShell.vue:558-562`, `types.ts:183` and
`formulas.ts:55-64`.

`grep -n "343.68\|1.20095\|^import" packages/engine/src/formulas.ts` and
`sed -n '9,16p' packages/engine/src/constants.ts`, both run this session, confirm the
temperature-only scaling and the 20 °C / 30 % RH constants.

The 1624-file corpus statistic and the ppm-level back-solve come from a research agent's
report in this session; the `.wdr` corpus was not re-counted here. That figure is relayed,
not independently verified. The `GAPS.md` §A6 content and all the line references above were
read directly.
