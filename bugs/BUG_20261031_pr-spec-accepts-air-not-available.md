# The radiator spec solver accepts air "not available" and blanks values

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
