# The "Ignore humidity and air pressure" tooltip tells the user the opposite of what the flag does

**Where:** `packages/ui/src/ui/components/AdvancedOptions.vue:47`, the `title` on the
`envIgnoreHumidityAndPressure` checkbox.

**Status:** RESOLVED 2026-08-27.

## Symptom

The hover text reads:

> "Derive air density and sound velocity from **temperature alone, discarding the relative
> humidity and air pressure you entered**. WinISD stores all three in its project file and reads
> none of them, so tick this to reproduce its numbers exactly. It costs accuracy: SPL differs by
> about 0.07 dB at 30 °C."

A user reading that concludes humidity and pressure stop affecting the simulation. They do not.

## Evidence, re-verified 2026-08-27

`packages/design/engine/air.ts`, `airFor()`: the flag selects `winisdAir(tempK, humidityPct,
pressurePa)` — **all three arguments are passed and all three are used**. Humidity enters through
the water mole fraction and pressure appears twice, in that fraction and in `rho = gamma*p/c^2`.

Measured directly, six controlled environments (`winisd_research` FINDING-008,
`runs/qo93_air_output/results.jsonl`): with the flag's model, holding temperature at 293.15 K,

| RH | AP | c |
| --- | --- | --- |
| 30 % | 101325 | 343.684120962153 |
| 80 % | 101325 | 344.437969001986 |
| 0 % | 101325 | 343.234181075929 |
| 30 % | 95000 | 343.714140348792 |

Humidity moves `c` by 1.2 m/s and pressure by 0.03 m/s. "Temperature alone" is refuted.

## Cause

The flag's name is about the SOURCE of the environment, not about dropping inputs.
`WINISD_SCHEMA.md` §12/§13 and FINDING-006: WinISD stores T/RH/AP in the `.wpr` `[Box]` section
and reads NONE of them — it takes all three live from its app-level Options dialog. So the flag
means "ignore THIS PROJECT'S stored humidity and pressure, use the app-level ones", and the UI
substitutes those before calling in.

The tooltip was written from the flag's NAME rather than from its behaviour.

## Fix

Rewrite the tooltip to state what actually changes: the SOURCE of the three environment values,
and the fact that WinISD's own formula is used. Do not describe any input as discarded.

## Verification

Replaced with text that names the two things that actually change — the SOURCE of the three
environment values, and the FORMULA used — and states outright that all three still affect the
result, quoting the measured 1.2 m/s humidity swing from the table above. No input is described
as discarded. 350 UI tests pass.

The tooltip is now multi-line (`&#10;` breaks). A native `title` is a poor home for text this
long; whether it becomes a `[?]` popover is John's call, tracked as QO94.
