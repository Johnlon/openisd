# BUG_20260929_bp6-abc-port-gain-charts-missing

**Status:** OPEN

## Symptom
WinISD draws "Rear port - Gain" and "Front port - Gain" for 6th-order bandpass and ABC boxes.
OpenISD returns no data for either chart on those boxes.

## Evidence
winisd_research runs/bp6-w5-base2 and abc-w5-base2 (2026-09-29) log both charts (2087 points
each). OpenISD `SimulationEngine.sweep` sets `rearPortGain` only for `vented` and `frontPortGain`
only for `bandpass4`, so both are null for `bandpass6`/`abc`.
`test/domain/bp6-abc-port-gain-winisd.test.ts` fails: "OpenISD has no such chart" ×4.

## Cause
The gain arrays are gated to the one box type each chart was first built for.

## Fix
Compute both gains for bandpass6/abc: rear from the rear-port flow, front from the front-port
flow, on the same reference as the vented/BP4 gains.

## Verification
`test/domain/bp6-abc-port-gain-winisd.test.ts` ≤ 1e-12 against both captures.
