# BUG_20260929_bp6-abc-tl-ports-not-winisd

**Status:** RESOLVED

## Symptom
With "Use transmission-line model for ports" on, OpenISD's 6th-order bandpass and ABC charts
differ from WinISD's: SPL and transfer function by 44.5 dB (6th-order bandpass, 1190 Hz) and 5 dB
(ABC, 578 Hz), impedance by 1.5 and 1.9 Ω.

## Evidence
winisd_research runs/bp6-w5-tlports and abc-w5-tlports (2026-09-29, W5-1138SMF, box defaults,
`[SimulatorOptions] TLPorts=1`) against OpenISD on WinISD's grid.

## Cause
`Bandpass6Box` and `AbcBox` model every port as a lumped mass jωMap whatever `tlPortModel` says;
only `VentedBox` and `Bandpass4Box` use WinISD's line reactance (ρc/S)·tan(ωL/c)
(bugs/BUG_20260928_tl-port-model-not-winisd.md). The domain passes no end correction for the
6th-order bandpass and ABC ports.

## Fix
Pass each port's end correction (front, rear) from `projectSweep.ts`; use the line reactance for
each port in both boxes when `tlPortModel` is on. ⚠ unverified: whether WinISD also treats the ABC
intra-chamber port as a line.

## Verification
Fixtures from both runs; SPL, impedance ≤ 1e-12 relative, TF ≤ 1e-11 dB, as the 4th-order bandpass test.

## Resolution (2026-09-29)
Both boxes use the line reactance on their front and rear ports; the ABC intra-chamber port stays a
lumped mass (matches without it). Each vent's end correction comes from the new
`Vent.endCorrectionLength_m()` (the effective length at zero physical length), which the vented and
4th-order bandpass boxes now use too. SPL, Z ≤ 1e-12 relative, TF ≤ 1e-11 dB
(test/domain/tl-port-model-bp6-winisd.test.ts, tl-port-model-abc-winisd.test.ts).
