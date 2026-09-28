# BUG_20260928_tl-port-model-not-winisd

**Status:** RESOLVED

## Symptom
With "Use transmission line model for port" on, a vented box's charts differ from WinISD above
the port's pipe resonance: SPL and TF by up to 6.3 dB near 460 Hz, and rear port velocity by
0.23 m/s there.

## Evidence
winisd_research runs/vented-w5-tlports (W5, 10 L, Fb 38, Ql 7, Qa 30, Qp 15,
`[SimulatorOptions] TLPorts=1`, 2026-09-28) against OpenISD with `useTransmissionLinePortModel`
on: SPL 6.27 dB at 462.6 Hz, TF 6.27 dB, impedance 1.45 Ω at 30.9 Hz, excursion 0.11 mm at
33.9 Hz, port velocity 0.232 m/s at 467 Hz (WinISD 0.234, OpenISD 0.002).

## Cause
Fitted 2026-09-29 (winisd_research toys/w5_tl_port_model_check.py, complex impedance 2e-15, TF
1e-12, port velocity 4e-11). WinISD's vented box keeps its fixed losses at ωb from the Fb mass
Map = 1/(ωb²·Cab); TL mode only replaces the port's jωMap with (ρc/S)·tan(ωL/c), S the vent area
and L = Map·S/ρ − end correction (the physical length that tunes to Fb). OpenISD ignored the TL
switch in its winisd-lossy branch and ran its own lossy-line model only in the conventional one.

## Fix
`VentedBox` winisd-lossy branch: `winisdLinePortReactance` when `tlPortModel` is on;
`SweepParams.portEndCorrection_m` (Leff − length) carries the end correction. The conventional
lossy line is unchanged. Open: bandpass 4/6 and ABC ports in TL mode (need captures).

## Verification
`test/domain/tl-port-model-winisd.test.ts` against `test/fixtures/winisdTlPortsCapture.ts`: SPL
and impedance ≤ 1e-12 relative, TF ≤ 1e-12 dB, port velocity ≤ 1e-10. Red before (SPL −40.148
vs −40.251 dB at 1 Hz), green after; design suite 2389/2389.
