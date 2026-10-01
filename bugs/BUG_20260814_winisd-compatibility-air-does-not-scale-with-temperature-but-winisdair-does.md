# The WinISD-compatibility air mode SCALES with temperature; WinISD's own frozen air does not

# Status
WONTFIX — CLOSED 2026-10-01, superseded by experiment. This record's core diagnosis ("WinISD's own frozen air does not scale with temperature") was REFUTED by the controlled probe the 2026-08-21 human ruling asked for.

## Closure (2026-10-01)

The ruling of 2026-08-21 ("use a probe to figure out what winisd does FOR CERTAIN — mimic WinISD unless its buggy") WAS carried out, as ledger QO93 (questions.yml, 2026-08-27, answered by experiment): six controlled environments written to WinISD's own settings.ini before launch, outputs read from the .wpr at 15 significant digits (winisd_research FINDING-008, runs/qo93_air_output/results.jsonl).

Findings that refute this record:

1. WinISD's c IS a live computation that moves with the environment: ideal-gas moist mixing `c = sqrt(1.4·R·T/M)`, cross-validated at the two temperatures NOT in the fit — 1.3e-7 relative at 313.15 K, 2.0e-8 at 273.15 K. Not frozen.
2. roo = 1.4·AP/c² to 1.3e-15..2.6e-15 — derived from c, never a stored constant.
3. The env-t-303/env-rh-30 goldens' byte-identical c/roo are explained: those scenarios vary the PROJECT's [Box] env, which WinISD never reads for c/roo — the pair comes from WinISD's APP-LEVEL Options environment, which those captures never changed. "Frozen across project-env changes" ≠ "frozen, full stop".
4. The measured row at 313.15 K (c 356.223844028178, rho 1.11788898381182 — air.test.ts's MEASURED table) shows WinISD's own app-level pair at 40 °C is far from the 293.15 K pair.

The current `winisdAir(tempK, humidityPct, pressurePa)` implementation in `packages/design/engine/air.ts` (Hyland–Wexler + gamma·p/c²) reproduces all six measured environments to ≤ 2.5e-15 relative (air.test.ts pins every row), which is the QO93-ruled contract. The later QO88 (2026-08-23) and QO95 (2026-08-28, WinISD model now the DEFAULT) rulings build on it. The env-t-303 parity leg stays correctly bounded in test/winisd/fixtures/winisd-parity/divergences.json (the harness's air leg must approximate the goldens' capture-time app-level defaults, which the scenarios' project env cannot express).

No code change was ever needed or made for this record. The "re-verified 2026-09-26" line above asserted the code still scales — true, and ruled CORRECT by the experiment; it was a re-verification of the symptom without checking whether the ruling had been answered.

(For the historical record, the original diagnosis follows.)

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
