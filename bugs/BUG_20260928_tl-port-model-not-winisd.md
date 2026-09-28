# BUG_20260928_tl-port-model-not-winisd

**Status:** OPEN

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
OpenISD's TL port (`engine/boxes/port.ts` `portImpedance`) is a lossy line with a resistive
radiation load. WinISD's port in TL mode is Rap + j·(ρc/S)·tan(ωL/c), with L and S from the vent
(winisd_research GHIDRA_FINDINGS.md, 6th-order bandpass load `0x567d10`; ⚠ `0x4bd850` = tan is
inferred from the call shape, and the vented routine is not yet checked).

## Fix
Fit runs/vented-w5-tlports with WinISD's form, confirm, and use it as the default TL port model.

## Verification
Fixture from runs/vented-w5-tlports; engine test ≤ 1e-12 relative on impedance, TF, port velocity.
