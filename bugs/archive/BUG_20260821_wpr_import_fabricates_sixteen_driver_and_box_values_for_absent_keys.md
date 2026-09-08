Status: RESOLVED — `useApplicationIO.ts:220` defines `numOrAbsent()` (returns `number | undefined`,
never a literal default) and all sixteen sites (`bType`, `Vr`, `Vf`, `npr`, vent `dia`/`len`/
`endCorrection`, PR `Sd`/`Xmax`/`Me`/`Vas`/`Fs`/`Qms`, `Ql`/`Qa`/`Qp`, `P`, `Rg`) now call it
instead of `parseFloat(x || '<literal>')`.

# `.wpr` import fabricates sixteen box/PR values when a key is absent

## Symptom

`parseWprToState` reads every `.wpr` value as `parseFloat(section['Key'] || '<literal>')`. A key
the file does not carry becomes an invented number that is indistinguishable, downstream, from
one WinISD actually wrote. The design then simulates, plots and exports on values nobody stated.

## Evidence

`packages/ui/src/logic/useApplicationIO.ts`, all sixteen:

| Line | Code | Invented |
|---|---|---|
| `:221` | `parseInt(boxSec['BType'] \|\| '1', 10)` | **the box type itself** — defaults to vented |
| `:230` | `parseFloat(boxSec['Vr'] \|\| '0.030')` | 30 L rear volume |
| `:231` | `parseFloat(boxSec['Vf'] \|\| '0.015')` | 15 L front volume |
| `:232` | `parseInt(boxSec['npr'] \|\| '1', 10)` | one passive radiator |
| `:237` | `parseFloat(activeVentSec['dia'] \|\| '0.05')` | 50 mm vent |
| `:238` | `parseFloat(activeVentSec['len'] \|\| '0.10')` | 100 mm vent |
| `:240` | `parseFloat(activeVentSec['endCorrection'] \|\| '0.732')` | one-flanged end correction |
| `:247` | `parseFloat(prSec['Sd'] \|\| '0.0133')` | a 133 cm² radiator cone |
| `:248` | `parseFloat(prSec['Xmax'] \|\| '0.012')` | 12 mm excursion |
| `:249` | `parseFloat(prSec['Me'] \|\| '0')` | zero added mass |
| `:250` | `parseFloat(prSec['Vas'] \|\| '20.0')` | 20 L compliance volume |
| `:251` | `parseFloat(prSec['Fs'] \|\| '20.0')` | 20 Hz resonance |
| `:252` | `parseFloat(prSec['Qms'] \|\| '5.0')` | mechanical Q of 5 |
| `:268-270` | `Ql \|\| '10'`, `Qa \|\| '100'`, `Qp \|\| '100'` | box losses |
| `:273` | `parseFloat(sigSec['P'] \|\| '1')` | 1 W input |
| `:274` | `parseFloat(sigSec['Rg'] \|\| '0.1')` | amplifier series resistance |

Rows `:247-252` are the worst: a `.wpr` with no `[PassiveRadiator]` section, or a malformed one,
yields a **fully specified passive radiator** — area, excursion, Vas, Fs, Qms — none of it from
the file.

**Second defect in the same expression.** `parseFloat('')` is `NaN`, so `sec['K'] || '0.0133'`
fires for a key that is PRESENT but empty exactly as it does for one that is absent. The code
cannot distinguish "WinISD wrote nothing here" from "this key does not exist", and both become
the literal.

**It contradicts a rule this repo already holds.** `AGENTS.md` / `CODE_REVIEW.md`: *"Never
coerce a missing value into a control-flow bound. Absent data is a gap to surface, never a
default to invent."* `parseFloat(x || '<literal>')` is that coercion, sixteen times in one
function.

**Same fake numbers on both sides of the boundary.** `Ql=10`, `Qa=100`, `Qp=100` and `Rg=0.1`
are invented here on IMPORT and hardcoded on EXPORT
(`packages/winisd/src/classic/wpr.ts:163,166,187` — see
`bugs/BUG_20260821_wpr_export_writes_fabricated_constants_over_real_design_state.md`). A round
trip through OpenISD therefore appears lossless while both directions are fabricating.

## Cause

Not established. Every literal is a plausible driver/box value, so the pattern reads as
"sensible default" rather than as invention — which is why it survived sixteen repetitions. No
call site distinguishes an absent key from a stated one, because the parse discards that fact
before anyone can act on it.

## Fix

Applied. `numOrAbsent()` returns `undefined` for a key the file does not carry or carries
empty; every former fabrication site now calls it. Per-field handling matches the fix's own
prescription: `BType` (`useApplicationIO.ts:227`) throws loudly when absent or unrecognised rather
than defaulting to vented; the passive radiator is built only when all four of
`Sd`/`Vas`/`Fs`/`Qms` are present (`hasPr`, line ~255) and throws if `BType=4` claims one but
the data is missing; every other field (`Vb`/`Vf`/`Ql`/`Qa`/`Qp`/`Pin`/`Rs`/`ventD`/`ventL`/
`endCorrection`/`prNum`) goes through `assign()`, which leaves the UI field untouched when
absent instead of writing a literal.

Interacts with the QO61 rewrite: this parse moves to `@openisd/winisd` as a raw reader
(objective 2 of `docs/plans/PLAN_QO60_LAYERING_REMEDIATION.md`) — not yet done, but no longer
blocking, since the raw-or-absent behaviour this bug required is already in place here.

## Verification

`useApplicationIO.ts:227-233` throws `'.wpr has no [Box] BType...'` when `bType` is `undefined`, and
throws on an unrecognised `BType` value. `useApplicationIO.ts:255-258` throws when `BType=4` but
`hasPr` is false (Sd/Vas/Fs/Qms not all present) — a `.wpr` with `[PassiveRadiator]` removed
does not produce a radiator. Not run under vitest this session (a full run was in progress);
verified by direct code inspection.
