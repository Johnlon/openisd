# BUG_20261101_air-dq-marks-not-shown

**Status:** FIXED (T637, 1 Nov 2026)
Found: John, 1 Nov 2026, using the Advanced tab ("there are missing dq marks on this screen").

## Symptom

Advanced tab, air boxes RH 30 E, p 125594.29 E, c 242.00 E, ρ 3.00000 E, T 293.15 C. The typed
c cannot be honoured (242 m/s needs about 145 K, below the 173.15 K floor), so the solver gives
up on T and T keeps the app value. No mark appears on any air box; the user sees a typed c that
does nothing and no reason. Likewise with T and RH both C and c typed: humidity gets a
"missing dependencies" issue and nothing is shown. Only the range check mark ever appears.

## Cause

The Advanced tab's air boxes took their marks from `airFieldDataQuality` in
`packages/ui/src/hooks/OriginalShell-hooks.ts`: a range check with its own table of limits that
never read the field's `dq`. The marks `resolveAir` wrote with `setDq` were never shown. The same
function also held UI-side limits (a UI-does-no-maths breach).

## Fix

- `createEnvironmentAir` now reads each box with `dqOfCell(field)` (the field's own marks and
  provenance); `airFieldDataQuality` and its limits table are deleted.
- A typed c or rho the solver cannot honour stays E. The issue marks the typed box and the box it
  could not solve (`fields` = target + the typed driver) and its sentence gives the reason
  ("... no temperature in range gives this c ...").
- Back-calculation runs only along strong dependencies: a typed c may solve T; a typed rho may
  solve p (c known) or c (p known). A typed c never solves RH or p (it gave p = 8091 Pa for c = 349).
  The app fills p, then RH, then T, so T is the open box for a typed c.
- The -100..+100 degC typing band on ADV_TEMP_K is gone: limits 0..1000 K, floor positive.

## Verification

`packages/ui/test/ui/air-dq-marks.browser.spec.ts` (Original, and the phone at 374x705 with no
clipping): T cleared, c typed 900, the c box and the T box each show a mark whose title gives the
reason. Unit: `packages/design/test/engine/air-solver.test.ts`, `air-state.test.ts`,
`packages/ui/test/hooks/OriginalShell-hooks.test.ts`.
Note: the 242 m/s example is now honoured (T = about 146 K is inside the model); a c of 900 m/s
needs a temperature past 1000 K and shows the mark.
