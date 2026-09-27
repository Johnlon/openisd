# BUG_20260927_tuning-absent-when-port-length-entered

**Status:** OPEN

## Symptom
A vented or bandpass 4th project whose port was set by LENGTH (tuning frequency blank) sweeps to
nothing under the default WinISD loss model: every value is NaN and the charts show an issue instead
of a curve. ⚠ unverified in the running app; follows from the code below.

## Evidence
packages/design/domain/project/openISDProject.ts `#boxSpecificParams`: vented feeds
`Fb: box.vented.tuning_goal_hz.value ?? undefined`, bandpass 4th feeds
`Ff: front.tuning_goal_hz.value ?? undefined`. packages/design/domain/cell.ts:445: tuning goal and
length are a solved pair; entering the length clears the tuning goal. VentedBox / Bandpass4Box
`winisd-lossy` read `P.Fb ?? NaN` / `P.Ff ?? NaN` for the port mass and the losses.

## Cause
The engine's WinISD form needs a tuning frequency; the domain passes only the entered goal, never
the tuning the entered length achieves (`ventAchievedFb` exists for vented).

## Fix
Feed the achieved tuning when the goal is blank (vented: `ventAchievedFb`; bandpass 4th: the
front-chamber equivalent). How WinISD fills Fb/Ff when the length is typed: check by capture first.

## Verification
Engine test: vented and bandpass 4th projects with length only, tuning blank, sweep finite and equal
the same project entered by its achieved tuning.
