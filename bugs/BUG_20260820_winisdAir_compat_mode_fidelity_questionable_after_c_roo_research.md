Status: OPEN

# `winisdAir()` compat mode's fidelity to real WinISD is now questionable

# Status
OPEN

## Symptom

`packages/engine/src/air.ts`'s `winisdAir()` (the `ignoreHumidityAndPressure` opt-in) models
WinISD's "never reads the `.wpr` environment" behaviour as: compute ρ/c live from temperature
alone, at the reference humidity/pressure.

The 2026-08-19/20 investigation into how WinISD actually resolves a driver's `c`/`roo`
(`docs/design/WINISD_SCHEMA.md` §12, `bugs/BUG_20260819_engine_speed_of_sound_constant_disagrees_with_wdr_default_in_last_digit.md`)
found real WinISD's rule is considerably more specific than "ignore humidity/pressure,
temperature still matters":

- A driver with `c`/`roo` present uses them as-is — WinISD's actual T/RH/AP settings are
  irrelevant to it, temperature included.
- A driver missing both falls back to the **app-level Options dialog's live computation** —
  which DOES use temperature (and, per the dialog itself, humidity and pressure — the dialog
  has its own T/RH/AP, all three live).
- The project's own `.wpr` `[Box]` T/RH/AP (`ignoreHumidityAndPressure`'s actual subject) was
  confirmed INERT for `c`/`roo` in every one of 12+ machine-verified cells — WinISD really
  does never read it, matching the existing model's premise.

So `winisdAir()`'s premise (ignore the PROJECT's stored environment) is right, but its
implementation (temperature-only live compute, humidity/pressure pinned to reference) may not
match what a real blank driver actually shows, because that's governed by the APP-level
Options dialog — a live, mutable, three-variable store openisd has no concept of at all, not
a temperature-only function.

## Not yet investigated

- Whether `winisdAir()` is used anywhere a real behavioural difference would surface, or
  whether its current temperature-only approximation is close enough in practice.
- Whether openisd should model an app-level-equivalent store, or whether the existing
  reference-environment fallback (`T_REF_K`/`RH_REF_PCT`/`P_REF_PA`) is an acceptable
  simplification now that there's no frozen `RHO`/`C` constant underneath it either
  (`bugs/BUG_20260819_...md` — those were deleted 2026-08-20, calculation-logic change,
  human-approved).

## Impact

Not fixed — needs investigation into actual callers/impact before any calculation-logic
change (AGENTS.md "Calculation logic — permission gate").
