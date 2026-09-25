# `winisdAir()` computes moist air at reference conditions instead of WinISD's stored constants

## Status
RESOLVED 2026-08-23 (fix under QO88's ruling; verification below).

## Symptom

With "Ignore humidity and air pressure (as WinISD does)" CHECKED, the Advanced pane's air
density read 1.20096. WinISD's own value at factory defaults — the value the flag exists to
pin (QO7) — is 1.20095217714682, printed 1.20095. The committed Playwright expectation
`advanced-environment.browser.spec.ts` (`toHaveValue('1.20095')`) failed on a tree with no
uncommitted engine changes. A second consequence: at the default temperature the ignore
branch and the physics branch returned identical numbers, so the checkbox was observably
inert exactly where the parity guarantee is supposed to show.

## Cause

Commit c83e0ad (2026-08-21) rewrote `winisdAir()` to reuse the moist-air model at reference
humidity/pressure. Moist air at reference is a different model from what WinISD actually
shows: 1.2009621 vs WinISD's live-captured 1.2009522 (8.3 ppm). The rewrite was bundled into
an unrelated ".wpr export fidelity" checkpoint (verified: that commit's `.wpr` work never
touches air.ts) on the strength of a sign-off quote deleting the frozen `RHO`/`C` constants.

## Resolution (QO88, John, closed 2026-08-23)

The ruled contract: WinISD computes `c`/`roo` LIVE from its app-level Options environment
(never a frozen constant, and never the project's `[Box]` env — `WINISD_SCHEMA.md` §12/§13);
at factory defaults that live computation lands on `c = 343.684120962152`,
`roo = 1.20095217714682`; and with openisd's air settings at defaults, the app's
live-calculated pair must EQUAL the constant pair the bridge stamps into generated files.

No closed-form reproduction of WinISD's internal air computation is recoverable from the
research corpus: `RE_GHIDRA_FINDINGS.md` has only the shape (`0x452b30` speed of sound
`c = √(K·p2/p1)`; `0x452ae0` density with unrecovered constants `_DAT_005d9ba0/9b90/9bb0`),
and five physically-motivated closed-form candidates each miss the live-captured point by
8 ppm or more (catalogued in `packages/engine/src/air.ts`'s `WINISD_MEASURED_*` docstring).

Implemented mechanism:

- `packages/engine/src/air.ts` declares `WINISD_MEASURED_C_REF = 343.684120962152` /
  `WINISD_MEASURED_RHO_REF = 1.20095217714682` — the raw IEEE-754 doubles gdb captured live
  from WinISD (`RE_GHIDRA_FINDINGS.md` "LIVE DEBUGGER CAPTURE"), 15 sig figs. The `.wpr`
  TEXT form `...153` is NOT substituted anywhere, per BUG_20260819's ban (its origin: both
  digits are genuine outputs of different save-time app states; the raw double is the
  in-memory truth this constant models).
- `winisdAir(tempK, humidityPct, pressurePa)` returns the measured pair scaled by the ratio
  the module's own CIPM-2007 moist-air model gives between the caller's conditions and the
  reference conditions (293.15 K / 30 % / 101325 Pa). At the reference conditions the ratio
  is exactly 1 → WinISD's pair to the last bit; away from them it varies continuously and
  physically, anchored to the one verified point.
- UI wiring (`logic/environment.ts` `resolveAirEnvironment`, applied in
  `OriginalShell.vue`'s `advAir` and `appState.ts`'s `syncedP`): when the toggle is on, the
  PROJECT's humidity/pressure are swapped for the app-level Options environment
  (`presentationState.ui.envDefaults`) before the engine sees them — the §12/§13 semantics
  (ignore the project env; read the app-level env). Temperature stays the project's own (the
  toggle's label names exactly what it discards). Persistence is unaffected: autosave/share
  read `toUiParams()` directly, never the substituted `syncedP`.
- The two branches now differ at defaults (1.20095 vs 1.20096), so the checkbox is
  observably live again.

The `env-t-303`/`env-rh-30` goldens' byte-identical `c`/`roo` (the "frozen pair" reading in
the original diagnosis) are consistent with this model: those project files vary the
PROJECT env, which WinISD never reads for `c`/`roo`, so the pair is constant across them —
it is the app-level env (untouched across those captures) that would move it.

## Verification

- `npx vitest run packages/engine/test/air.test.ts` — 13/13, including the QO88 invariant
  test (`airFor` at defaults with the toggle === `WINISD_MEASURED_*`, the bridge-stamped
  pair) and the off-defaults variance test.
- `npx playwright test packages/ui/test/ui/advanced-environment.browser.spec.ts --workers=1`
  — the previously-red "ticking 'Ignore humidity and air pressure' pins the readouts to
  WinISD's constants" green, including the humidity-then-ignored assertions.
- `npx vitest run packages/winisd` — 1280/1280 (14 files). The parity harness's air test now
  performs the same substitution the app does (reference humidity/pressure stand in for the
  goldens' capture-time Options defaults; the scenario's own temperature is kept). Fixture
  maintenance per the suite's own process: the stale `*` `air.c`/`air.roo` entries in
  `divergences.json` deleted (the compat pair and WinISD's stored pair now agree exactly),
  the `env-t-303` entries' causes rewritten to the anchored-model mechanism with measured
  bounds (1.81e-2 / 3.51e-2 relative at 303.15 K).
