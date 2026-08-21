Status: OPEN

# Seven local reference-air wrappers duplicate `airFor({})`

## Symptom

Four files each declare their own function returning the air at the reference environment, and
`@openisd/engine` already exports one that does it.

## Evidence

Introduced 2026-08-20 during the RHO/C deletion (this agent's work, not pre-existing):

| File | Declaration |
|---|---|
| `packages/engine/src/alignments.ts:31` | `const refRho = () => moistAirDensity(T_REF_K, RH_REF_PCT, P_REF_PA)` |
| `packages/engine/src/alignments.ts:32` | `const refC = () => moistAirSoundVelocity(T_REF_K, RH_REF_PCT, P_REF_PA)` |
| `packages/ui/src/diagnostics/selftest.ts:36` | `const refRho = ...` — byte-identical to alignments.ts:31 |
| `packages/ui/src/diagnostics/selftest.ts:37` | `const refC = ...` — byte-identical to alignments.ts:32 |
| `packages/ui/src/logic/environment.ts:30` | `export function referenceC()` |
| `packages/ui/src/logic/environment.ts:33` | `export function referenceRho()` |
| `packages/ui/src/logic/prWinIsdFields.ts:17` | `function referenceRhoC2()` — returns `rho * c * c` |

`packages/engine/src/air.ts:143-152` already provides this:

```ts
export function airFor(env: AirEnvironment): Air {
  const tempK = env.tempK ?? T_REF_K;
  if (env.ignoreHumidityAndPressure) return winisdAir(tempK);
  const humidityPct = env.humidityPct ?? RH_REF_PCT;
  const pressurePa  = env.pressurePa  ?? P_REF_PA;
  return { rho: moistAirDensity(...), c: moistAirSoundVelocity(...) };
}
```

Every field defaults, so `airFor({})` IS the reference air. The seven wrappers reimplement it,
two of them byte-for-byte in different packages.

## Cause

While deleting the frozen `RHO`/`C` constants, each call site needed the reference values. A
local alias was written at each site instead of finding the existing dispatch. The result is
seven names for one fact — the same duplication-by-convenience the architecture rules exist to
prevent, introduced while enforcing them.

## Fix

Not fixed. Delete all seven; call `airFor({})` directly at each site, or destructure it once
per function where both `rho` and `c` are needed. `referenceRhoC2()` becomes the arithmetic at
its two call sites using that result.

`environment.ts`'s two are EXPORTED, so their call sites (`DriverEditorModal.vue`) change too.

## Verification

N/A — open. Afterwards: no file outside `air.ts` declares a function whose body is only a call
to `moistAirDensity`/`moistAirSoundVelocity` with the reference constants.
