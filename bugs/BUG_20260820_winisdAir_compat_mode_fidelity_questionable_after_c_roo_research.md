Status: RESOLVED

# `winisdAir()` compat mode's fidelity to real WinISD is now questionable

# Status
RESOLVED 2026-08-23 — the fidelity gap this bug identified is closed by the QO88 fix
(mechanism and verification in
`BUG_20260823_winisdair_recomputes_moist_air_instead_of_winisds_stored_constants.md`).

## What this bug identified

`winisdAir()` (the `ignoreHumidityAndPressure` opt-in) modelled WinISD's "never reads the
`.wpr` environment" behaviour as: compute ρ/c live from temperature alone, humidity and
pressure pinned to reference. The 2026-08-19/20 research (`WINISD_SCHEMA.md` §12) showed
real WinISD's rule is different: the project's `[Box]` T/RH/AP is inert (matching the
premise), but a blank driver's `c`/`roo` come from the APP-LEVEL Options dialog's live
three-variable computation — a store openisd then had no concept of.

## How it resolved

Both halves of the "not yet investigated" list are now answered:

- **Where a behavioural difference surfaces:** `airFor`'s ignore branch feeds the Advanced
  pane readouts and the sweep — the Playwright pin (`advanced-environment.browser.spec.ts`,
  1.20095 vs the moist model's 1.20096) was exactly such a surfacing.
- **Whether openisd should model an app-level store:** it already had one —
  Options → General → Environment (`presentationState.ui.envDefaults`). The fix wires it as
  §12/§13's app-level Options analog: with the toggle on, `resolveAirEnvironment`
  (`logic/environment.ts`) substitutes its humidity/pressure for the project's before the
  engine computes, and the engine's `winisdAir` anchors the result to WinISD's live-captured
  pair (`WINISD_MEASURED_C_REF`/`WINISD_MEASURED_RHO_REF`) so the Options-defaults case
  reproduces real WinISD exactly (QO88's ruled invariant: live-calculated-at-defaults equals
  the bridge-stamped constant pair).

One deliberate divergence remains, by design: ignore-mode temperature stays the PROJECT's
own (the toggle's label names humidity and pressure as what it discards), where real WinISD
would use the Options dialog's temperature. At the default temperature the two agree
exactly; the ledger question on the remaining readouts (OptionsModal's own preview and the
driver editor's reference pair still showing the pure moist model) is tracked separately in
`questions.yml`.
