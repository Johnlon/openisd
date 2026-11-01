# The radiator spec solver accepts air "not available" and blanks values

**Status:** RESOLVED (T637, 1 Nov 2026)

## Report

Found while chasing BUG_20261031_phone-pr-p173-cms-display. `OpenIsdPassiveRadiatorSpec.resolve`
and `PrEngine.solveSpec` / `checkSpec` take an `AirState` that can be `not available`. When it
is, Cms (and so Mms, Rms) is written not-available and the warning names `c` and `ρ` as missing
inputs.

## Ruling

John, 31 Oct 2026: "it is impossibl for air to be absent - its either the project value or the
app"; on the not-available state: "this is illegal state - sw error". See also the air model of
17 Oct 2026 (no default air; project air falls back to the app's; every calculation takes `Air`
from its owner).

## What is wrong

A code path exists for a state the model says cannot occur. If it ever fires, values go blank
with no error; the right outcome is a software error, not a blank. The same `AirState` kind is
read in `projectResolve.ts` and `PrEngine.solve` (`AIR_WORKING_NAMES` added to "missing").

## Fix

Own task. Make the radiator and driver spec solvers take `Air` (always present), remove the
not-available branches and the `missingAir` plumbing, and make the composition root prove air is
present before any resolve runs. Not in T628.

## Fix (T637)

John, 1 Nov 2026: "THERE IS NO SITUATION WHERE AIR IS ABSENT"; "IF I WIPE OUT THE PROJECT AIR THEN THE
APP LEVEL SETTING IS THE NEW VALUE, IF THE APP LEVEL SETTING IS REMOVED THEN THE BUILT IN HARD CODED
CONST IS THE VALUE"; "c AND ρ ARE CALCULATED FROM THE AIR PR/HUM/ETC".

- `AirState`, the `notAvailable` kind, `airIfAvailable`, `availableAir` and `airStateOf` are deleted.
  The driver, vent and radiator solvers, the box, the vent window, the sweep source and the UI
  readouts take `Air`; `OpenISDProject.air` is an `Air`.
- The chain for temperature, humidity and pressure is ONE step for the project: a cleared project
  value takes the app setting. The app setting is total on its own (`appEnvironmentOf`: a blank or
  out-of-range one is the built-in WinISD constant, inside the app setting). `AppAir` holds only
  those three. `resolveAir` writes a cleared one back as
  a calculated entry. c and rho are always calculated from those three; a typed one pins, clearing
  it returns to the calculated value; neither has a fallback of its own.
- `airFor`/solver issues stay as marks on filled values.
- Removed with it: `airQuantity`, `writeAirBack`, `airBlockedIssues`, `blockedOnAir`, `missingAir`.

## Verification

`packages/design/test/engine/air-state.test.ts`: type proofs that each solver's air parameter is
exactly `Air`; one test per chain step (project cleared takes the app value; app setting blank is
the constant; the constant reaches a cleared project value; c and rho calculated, never blank).
