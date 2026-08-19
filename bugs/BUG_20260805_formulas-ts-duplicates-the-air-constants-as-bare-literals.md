# BUG_20260805 — `formulas.ts` duplicates the air constants as bare literals

# Status
OPEN 2026-08-05


**Status:** OPEN — fix dispatched to a background agent in the same turn this file was written.

## Symptom

`packages/engine/src/formulas.ts` imports `C` and `RHO` from `constants.ts`, then ignores both
and hardcodes their numeric values inside the two functions that derive temperature-corrected
versions of them. Two copies of each constant exist with nothing keeping them in step: editing
`constants.ts` silently leaves `formulas.ts` computing from the old value.

## The code

`/home/john/work/winisd/openisd/packages/engine/src/formulas.ts:9`

    import { RHO, C } from './constants.js';

`/home/john/work/winisd/openisd/packages/engine/src/formulas.ts:56` — inside `soundVelocity()`

    return 343.68 * Math.sqrt(tempKelvin / 293.15);

`/home/john/work/winisd/openisd/packages/engine/src/formulas.ts:64` — inside `airDensity()`

    return 1.20095 * (293.15 / tempKelvin);

`/home/john/work/winisd/openisd/packages/engine/src/constants.ts:13-14`

    export const RHO = 1.20095;  // air density        kg/m³   (20 °C — WinISD)
    export const C   = 343.68;   // speed of sound      m/s     (20 °C — WinISD)

The two copies agree today, so no output is currently wrong. The defect is that nothing
enforces that agreement.

## Root cause

Commit `409bf2d57` (2026-07-03, "fix(engine): correct air constants to true 20 °C (matches
WinISD) — §20") corrected the constants and fixed exactly this defect class elsewhere — its
message records that `DriverDefineModal.vue` "hardcoded its OWN C=343/RHO=1.2 — a third,
different value". The `formulas.ts` instance was not found by that sweep, so it survived a
change whose whole purpose was to eliminate it.

The import at line 9 is what makes this a latent break rather than a style point: a reader and
a type checker both see the file consuming the shared constants, and neither is true of the
two functions that matter.

## Why it was not fixed on the spot

Fixing now. Four background agents were editing this repo when the bug was found; the fix is
carried by the engine-hardening agent, which is already in `packages/engine/` and is required
to prove the golden fixtures do not move.

## Fix

Substitute `C` for `343.68` at line 56 and `RHO` for `1.20095` at line 64. The values are
byte-identical to the imported constants, so the goldens must not move — if any golden moves,
the substitution is not equivalent and that is the finding, not a fixture to regenerate.

## **Evidence (artifact checked this session):**

`grep -n "343.68\|1.20095\|^import" packages/engine/src/formulas.ts` run 2026-08-05 against
the working tree, output quoted above verbatim: the import at line 9 and the two bare literals
at lines 56 and 64. `sed -n '9,16p' packages/engine/src/constants.ts` confirmed the exported
values `RHO = 1.20095` and `C = 343.68` are identical to the literals.

The `409bf2d57` attribution comes from a research agent's report in this session, which quoted
the commit message; the commit itself was not re-read here — that one claim is relayed, not
independently verified.
