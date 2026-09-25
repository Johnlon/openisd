# The drive-voltage → input-power inverse is computed inline in the shell, with a no-driver Re default that disagrees with the forward path

Status: OPEN

## Symptom

`OriginalShell.vue:~647` computes
`setInputPower_W((v * v) / (managedProject.toEngineDriver()?.Re || 8))` — the inverse of the
relation the engine owns as `driveVoltage()` (`packages/engine/src/formulas.ts:51`,
`sqrt(Pin·Re)`).

Two defects:
1. A physics calculation lives in a `.vue` file — the inverse has no engine home.
2. The no-driver defaults disagree: this inverse assumes `Re = 8`; `driveVoltage_V()`
   (`managedProject.ts`) assumes `Re = 1`. With no driver chosen, the Signal tab's voltage
   readout and `syncedP.eg` disagree.

## Evidence

**Evidence (artifact checked this session):** both sites read 2026-08-21 during the A3
review — the shell's inline `(v * v) / (… || 8)` and `formulas.ts:51`'s `driveVoltage`. The
divergent defaults are visible in the two expressions. Pre-existing: the A3 diff only
repointed the expression's operands; the inline formula predates it.

## Cause

The voltage→power direction was never given an engine function, so the shell computed it
locally, and the two directions' no-driver fallbacks were chosen independently.

## Fix

Not fixed. Direction: add `powerForDriveVoltage(v, re)` to `packages/engine/src/formulas.ts`,
repoint the shell, and pick ONE agreed no-driver Re default for both directions (needs a
choice; 8 Ω matches the nominal-impedance convention, 1 Ω matches the current forward path).

## Verification

Closure = engine function exists with a unit test, shell calls it, one shared default pinned
by a test asserting the two directions agree with no driver chosen.
