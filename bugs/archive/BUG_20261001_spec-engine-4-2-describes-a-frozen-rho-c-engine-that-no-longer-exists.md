# BUG_20261001_spec-engine-4-2-describes-a-frozen-rho-c-engine-that-no-longer-exists

**Status:** FIXED 2026-10-01 — SPEC_ENGINE.md §4.2/§4.3 rewritten: no frozen RHO/C, both air
models consume T/RH/p, environment rows added to the SweepParams table. The c/roo provenance
question is consolidated in `docs/research/C_ROO_PROVENANCE.md`.

## Symptom

`docs/spec/SPEC_ENGINE.md` §4.2 (lines 194–195) and the §4.3 `tempK` table row (line 239)
state that the engine holds frozen reference constants `RHO`/`C` (1.20095217714682 kg/m³ /
343.684120962153 m/s at 293.15 K) which `sweep`/`circuit` "rescale by the live
`SweepParams.tempK` when present", and that "`humidityPct`/`pressurePa` are UI-only, not
consumed by the engine". All three claims are false of the current engine:

1. No `RHO`/`C` constants exist in `packages/design/engine/` — `engine/air.ts`'s header
   ("There is no frozen ρ/c constant, in WinISD or here", machine-verified 2026-08-20) says
   the module holds none, and grep finds no such exports.
2. There is no rescale step: `airFor()` (`air.ts:276-289`) computes ρ/c directly from the
   environment via `moistAirDensity`/`moistAirSoundVelocity` (CIPM-2007) or `winisdAir()`
   (Hyland–Wexler parity mode).
3. `SweepParams` carries `tempK` AND `humidityPct` AND `pressurePa` (`types.ts:280-289`),
   and both humidity and pressure fully affect the result — `types.ts` states this
   explicitly: "Neither setting discards humidity or pressure — both still fully affect the
   result either way."

## Steps to reproduce

1. Read `docs/spec/SPEC_ENGINE.md` lines 194–195 and 239.
2. `grep -rn "\bRHO\b" packages/design/engine/` — only air.ts *comments* saying it holds no
   such constant.
3. Read `packages/design/engine/air.ts:271-289` (`airFor`) and
   `packages/design/engine/types.ts:280-289` (SweepParams env fields).
4. Observe the contradiction: spec says tempK-only rescale + UI-only humidity/pressure;
   code computes moist-air ρ/c from all three.

## Evidence

Re-verified 2026-10-01: spec lines quoted above; `air.ts:46` ("This module holds no
`RHO`/`C` for the same reason"), `air.ts:276-289` (`airFor` uses tempK, humidityPct,
pressurePa); `types.ts:280-289` (all three on SweepParams with the humidity/pressure-are-
consumed doc); `test/winisd/winisd-parity-functional.test.ts:476` passes the project's
environment into the sweep.

## Cause

§4.2/§4.3 were written when the engine held frozen reference constants and rescaled them by
tempK alone. The engine was replaced by the moist-air model (air.ts, machine-verified
2026-08-20) and the spec section was never rewritten; the §4.2 export table still lists the
`RHO`/`C` rows from the old design.

## Fix

Rewrite SPEC_ENGINE.md §4.2: delete the `RHO`/`C` export rows (point at `air.ts`'s
environment model instead — no frozen constants; T/RH/p all consumed; `useWinisdAirModel`
selects the parity formula and defaults to true per QO95), and fix the §4.3 `tempK` row to
say humidity/pressure are engine inputs, not UI-only. Keep the full-precision correction
note only where it is history (or move it to an archive section).

## Verification

- Grep SPEC_ENGINE.md for "rescale" / "UI-only" — no remaining claims that the engine
  ignores humidity/pressure.
- The §4.3 table's environment rows match `SweepParams` in `types.ts` field-for-field.
