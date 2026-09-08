# `useApplicationIO.ts` duplicates the (now-corrected) air constants as bare, still-truncated literals

# Status
FIXED (superseded 2026-08-21) — `useApplicationIO.ts` no longer contains any `RHO`/`C` literals at
all; superseded by the air-model redesign (`packages/engine/src/air.ts`'s CIPM-2007 physical
model replaced the bare constants entirely).


**Found** 2026-08-14, while implementing the authorized fix for
`bugs/BUG_20260813_winisd-compatibility-air-returns-truncated-rho-and-c-not-winisds-own-pair.md`
(`packages/engine/src/constants.ts`'s `RHO`/`C` corrected from 6/5-significant-figure truncations
to WinISD's full-precision values).
**Status** OPEN — not fixed. `packages/ui/src/**` is outside this agent's file authorisation
(current session scope: `packages/engine/src/`, `packages/winisd/test/`); recorded here for the
UI-owning agent.

## Symptom

`packages/ui/src/logic/useApplicationIO.ts:234-235`:

    const RHO = 1.20095;
    const C = 343.68;
    const prCms = prVasM3 / (prSd * prSd * RHO * C * C);

A bare, local restatement of the engine's air constants — not imported from
`@openisd/engine`'s `constants.ts`. This is the same defect class as
`bugs/BUG_20260805_formulas-ts-duplicates-the-air-constants-as-bare-literals.md`, which fixed the
identical pattern in `packages/engine/src/formulas.ts`; this instance was not caught by that
sweep because it lives in `packages/ui/src`, outside that agent's scope.

Until 2026-08-14 the two copies agreed (both truncated to 1.20095/343.68). They no longer do:
`constants.ts` now exports `RHO = 1.20095217714682`, `C = 343.684120962153` (full WinISD
precision, verified against the `winisd-parity` goldens). `useApplicationIO.ts`'s passive-radiator
`Cms` derived from an imported `.wpr` is now off by the same ~1.2e-5 relative this session
measured and fixed everywhere else in the engine — silently, because nothing imports the shared
constant here to keep the two in step.

## Fix

Replace the two local literals with `import { RHO, C } from '@openisd/engine'` and drop the
bare declarations — mirroring the fix already applied to `formulas.ts`. Out of scope for the
current session (file authorisation); no golden/test in `packages/ui` currently pins this exact
value, so no rebaseline is anticipated, but the importing agent should verify.
