# BUG_20260924_sweep-ignores-options-environment-setting

**Status:** OPEN

## Symptom

Changing Options → Environment changes the temperature, humidity and pressure the project
displays, but the charts do not move. The sweep keeps using 293.15 K / 30 % / 101325 Pa
whatever the Options dialog was set to, as long as the project itself has not overridden them.

## Evidence

Re-checked 2026-09-24.

- `packages/ui/src/hooks/OptionsModal-hooks.ts:186` — saving the Options dialog calls
  `settings.setEnvDefaults(editedEnv.value)`, which reaches
  `packages/persistence/src/repos/appSettingsRepo.ts:88` and persists.
- `packages/design/domain/openisdDomain.ts:2886-2890` — `envTempK` returns
  `calculatedCell('temperature_K', this.#engine.envDefaults().tempK)` when the project's own
  slot is null. `Engine.envDefaults()` (`packages/design/engine/Engine.ts:351`) forwards to
  `AppSettings.envDefaults()`, so the displayed value follows the Options dialog. Same pattern
  for `envHumidityPct` (`:2912`) and `envPressurePa` (`:2935`).
- `packages/design/domain/openisdDomain.ts:3053-3055` — `#sweepParams` reads the **raw** slot:
  `tempK: this.#current().environment.temperature_K ?? undefined`. The slot is still null, so
  `undefined` goes to `solveEnvironment`, which falls back to `DEFAULT_T_REF_K` /
  `DEFAULT_RH_REF_PCT` / `DEFAULT_P_REF_PA` in `packages/design/engine/air.ts:70-72`.

`envDefaults()` never reaches `#sweepParams`. Two sources for the same three numbers: the cells
read the app setting, the sweep reads the `air.ts` constants.

Not visible in the W5 probe (`docs/research/PROBE_W5_SEALED_20260924.md`) only because the app
setting was left at its defaults, which happen to equal the `air.ts` constants.

## Cause

`#sweepParams` bypasses the `envTempK` / `envHumidityPct` / `envPressurePa` fields it should be
reading and goes to the raw JSON slot underneath them, which is where the app-setting fallback
does not apply.

## Fix

`#sweepParams` reads the project's environment through the same fields the UI reads —
`this.envTempK.value` and friends — so the app-setting fallback applies once, in one place.

## Verification

Unit test: set the app settings' env defaults away from 293.15 / 30 / 101325 on a project whose
own environment is unstated, run `Engine.sweep`, and assert the passband SPL moves. It must
equal the SPL of the same project with those values entered on the project directly.
