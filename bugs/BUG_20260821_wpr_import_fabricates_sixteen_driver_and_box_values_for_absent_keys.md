Status: OPEN

# `.wpr` import fabricates sixteen box/PR values when a key is absent

## Symptom

`parseWprToState` reads every `.wpr` value as `parseFloat(section['Key'] || '<literal>')`. A key
the file does not carry becomes an invented number that is indistinguishable, downstream, from
one WinISD actually wrote. The design then simulates, plots and exports on values nobody stated.

## Evidence

`packages/ui/src/logic/useDesignIO.ts`, all sixteen:

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

Not fixed. Absent must stay absent: the parse returns `undefined` for a key the file does not
carry, and the caller decides — surface it, refuse the import, or leave the field genuinely
unset — with an explicit, testable rule per field rather than a `||` literal. `BType`
especially must never default: a `.wpr` with no box type is not a vented box, it is an invalid
file.

Interacts with the QO61 rewrite: this parse moves to `@openisd/winisd` as a raw reader
(objective 2 of `docs/plans/PLAN_QO60_LAYERING_REMEDIATION.md`), which is the natural place to
make it return raw-or-absent rather than raw-or-invented.

## Verification

N/A — open. Afterwards: importing a `.wpr` with `[PassiveRadiator]` removed must NOT produce a
passive radiator, and importing one with no `BType` must fail loudly rather than open a vented box.
