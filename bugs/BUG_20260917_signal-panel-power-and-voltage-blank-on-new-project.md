# BUG_20260917_signal-panel-power-and-voltage-blank-on-new-project.md

Status: RESOLVED (re-verified 2026-09-26) — confirmed for the common case: with Re known, power defaults to 1 W entered. The 2026-09-24 drive-voltage/power ruling supersedes "always 1 W": with Re unknown, power is deliberately N and voltage defaults to 1 V instead (`openisdDomain.ts` `#powerDriveOver`).

## Symptom
When opening a new project from scratch (e.g. sealed w51138 and 6l), the Signal panel shows both P (system input power) and V (driver input voltage) blank.

## Requirement
P (system input power) must be initialised to 1W for all new project states.

## Evidence
Reproduced on fresh project creation: `OpenISDProject.empty()` → Signal tab shows Pin and driveV both empty/null.

## Cause
New project initialization does not set a default value for `powerDrive_W`. The field starts empty and nothing populates it. `driveVoltage_V` is derived from `powerDrive_W`, so it is also blank.

## Fix

Removed the `if (project.driver.ts.Re_ohm.get().value !== null)` guard in `ProjectBuilder.build()` (`packages/design/domain/openisdTransforms.ts:150`). `project.powerDrive_W.set(1)` now always runs for every new project.

## Verification

`npx vitest run packages/design/test/` → 1548 passed, 70 test files passed. The existing test "a new project stores the 1 W reference as a project input; drive voltage derives from it (S5/T5)" confirms power is 1W and voltage derives correctly.
