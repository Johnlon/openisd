# BUG_20261118_dummy-radiator-sized-by-a-1x-rule-the-2x-line-contradicts

**Status:** FIXED in T902

## Symptom
A new passive-radiator project with 2 or 4 drivers starts with one placeholder radiator, and the "2× rule" line under it
(John, 16 Nov 2026) says "needs 2 of these". The starting radiator contradicts the app's own rule. Found by the duplicate-logic
scan (`_agent_files/dupscan/REPORT.md`, finding 6).

## Cause
`packages/design/domain/box/openISDBox.ts` `#startDummyRadiator` sized the placeholder in the domain:
Xmax = max(2 × driver Xmax, N × Sd × Xmax / (radiator Sd × count)), that is 1× the array's displacement. The engine's rule,
`PrEngine.countForTwiceDisplacement`, asks for 2 × N × driver Vd.

## Fix
`PrEngine.placeholderRadiatorXmax(driverXmax, driverVd, nDrivers, prSd, prCount)` gives the Xmax that makes the radiators
displace 2 × N × driver Vd, never less than twice one driver's Xmax (John, 29 Sep 2026). The domain asks it, and takes the
radiator's Vd from `PrEngine.displacement`.

## Verification
`packages/design/test/domain/dummy-radiator-twice-rule.test.ts` (1, 2, 4 drivers: the 2× line says one radiator is enough):
2 and 4 drivers failed before ("expected 2 to be less than or equal to 1"), all pass after.
