# The WinISD-compatibility air mode SCALES with temperature; WinISD's own frozen air does not

# Status
BLOCKED — ruling received 2026-08-21 (see below): mimic WinISD unless it is measurably buggy,
but only after a probe against the real WinISD binary establishes ground truth beyond the
existing two-sample evidence. Probe not yet run; `winisdAir()` still scales `rho`/`c` with
`tempK` (`packages/engine/src/air.ts:135-137`).


**Found** 2026-08-14, while re-running `packages/winisd/test/winisd-parity.test.ts` after fixing
the air-constant truncation (`bugs/BUG_20260813_winisd-compatibility-air-returns-truncated-rho-and-c-not-winisds-own-pair.md`).
**Severity** wrong number, large — 1.69e-2 relative on `c`, 3.36e-2 on `roo` (both far bigger
than the ~1e-5 truncation the sibling bug fixed).
**Status** ⛔ **NOT FIXED — blocked on the human.** `packages/engine/src/air.ts`'s `winisdAir()`,
which `AGENTS.md` §"Calculation logic — permission gate" reserves to an explicit human decision.
This file is that document.

## Symptom

`env-t-303` (`environment.T = 303.15`, `phi = 0.3`, `p = 101325`) is the parity suite's dedicated
temperature-leg scenario. Its own `purpose` string already names the expected physical answer:
*"Physically derived air would give c about 349.51 m/s and rho about 1.16133; env-rh-30 is its
293.15 K twin, identical in every other value."*

| | `c` | `roo` |
| --- | --- | --- |
| WinISD (`goldens/env-t-303.wpr`) | `343.684120962153` | `1.20095217714682` |
| WinISD (`goldens/env-rh-30.wpr`, the 293.15 K twin) | `343.684120962153` | `1.20095217714682` |
| openisd `airFor({ tempK:303.15, …, ignoreHumidityAndPressure:true })` | `349.4968808605314` | `1.161336403531553` |

**WinISD's `c`/`roo` are byte-identical between the 303.15 K scenario and its 293.15 K twin.**
WinISD's own frozen compatibility air does not move at all when only the box's stated
temperature changes — it is a fixed pair, full stop, not a pair scaled by √T/1/T the way
openisd's `winisdAir()` computes it.

## The code

`packages/engine/src/air.ts:121-127`:

    /**
     * WinISD's air: the fixed `RHO`/`C` pair, scaled by temperature alone (ρ ∝ 1/T, c ∝ √T).
     * Returns `RHO` and `C` exactly at `T_REF_K`.
     */
    function winisdAir(tempK: number): Air {
      return { rho: RHO * (T_REF_K / tempK), c: C * Math.sqrt(tempK / T_REF_K) };
    }

The module docstring at lines 35-42 already says the opposite of what the code does:

    * WinISD stores temperature, pressure and humidity in the `.wpr` `[Box]` section and never
    * reads them: its `c`/`roo` stay at those 15 digits through a forced recompute at 303.15 K and
    * come back at them when the two fields are deleted and regenerated.

That sentence is a direct, correct description of the golden evidence above (the docstring
predates the goldens that now prove it — `env-t-303` is exactly the "forced recompute at
303.15 K" case it names). The function below it does not follow its own docstring: it takes
`tempK` as a parameter and scales both outputs by it, instead of returning the frozen pair
unconditionally.

## What it costs, per parity row

Only `env-t-303` exercises a non-reference temperature through the compatibility mode in the
current scenario set, so exactly one scenario's `air`/`c`/`roo` rows are affected today:

| row | measured |
| --- | --- |
| `air.c` (`env-t-303`) | 1.691e-2 relative |
| `air.roo` (would be, if compared directly — `c`/`roo` are only asserted via the combined `air` test) | 3.363e-2 relative |

Small today only because `env-rh-00`/`env-rh-30`/`env-rh-90`/`env-p-95000`/`env-p-105000` all run
at `T = 293.15` (they vary humidity/pressure only, which the compatibility mode ignores by
design), so this is the ONE scenario in the current set that can see it. Any driver record or
future scenario carrying a non-reference temperature through the compatibility path would show
the same divergence.

## Why this is not a one-line edit anyone may make

`winisdAir()` is not confined to the parity suite's compatibility toggle. `driver.ts:32-33` (the
`c`/`roo` autofill written into an exported `.wdr`) and every other reader of `airFor({
ignoreHumidityAndPressure: true, tempK })` gets the same scaled-not-frozen answer. Freezing it
unconditionally (dropping the `tempK` scaling entirely, always returning `{ rho: RHO, c: C }`) is
the fix the evidence points to, but:

- it changes `air.ts`'s public behaviour for every caller that passes a non-reference `tempK`
  with `ignoreHumidityAndPressure: true`, not only the parity suite;
- `packages/engine/test/air.test.ts` may pin the current (scaling) behaviour and would need
  rebaselining;
- the docstring already asserts the frozen behaviour, so fixing the code to match it is a small
  diff, but it is still a calculation-logic change requiring the human ruling this repo's rules
  reserve for exactly this class of change.

## Human ruling (2026-08-21)

"Use a probe to figure out what winisd does FOR CERTAIN - mimic Winisd unless its buggy." Not a
final freeze-vs-live decision — a probe against the real WinISD binary is required first to
establish ground truth beyond the existing two-sample evidence (293.15K/303.15K), before
implementing either direction. Once the probe result is in: mimic WinISD's actual behavior
unless it is itself measurably wrong (buggy), in which case implement the correct physics and
record the divergence.

## Verification, once a fix is authorised

`npx vitest run --project winisd packages/winisd/test/winisd-parity.test.ts` — `env-t-303 > air`
goes green. `packages/engine/test/air.test.ts` is reviewed for any assertion on `winisdAir`'s
temperature scaling and updated to assert the frozen pair instead, not loosened.
