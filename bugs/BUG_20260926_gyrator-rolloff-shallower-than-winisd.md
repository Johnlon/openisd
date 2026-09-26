# BUG_20260926_gyrator-rolloff-shallower-than-winisd

**Status:** OPEN

## Symptom

With "Simulate voice coil inductance" checked in both products, OpenISD's high-frequency
roll-off is shallower than WinISD's by a constant 0.56 dB from 5 kHz upward.

## Evidence

Measured 2026-09-26. Driver W5-1138SMF (`Le = 0.34 mH`, `Re = 3.4 Ω`), sealed 4.48 L,
`Rg = 0.1 Ω`, 1 W. WinISD 0.7.0.950 under wine, transfer-function chart traced from pixels
at `[SimulatorOptions] VCInd` 0 and 1 — one capture per launch, no chart-menu interaction,
so both runs are the same chart (`winisd_research/toys/probe_vcind_default_chart.py`,
artifacts `winisd_research/runs/vcind_default/`). OpenISD from `Engine.sweep` in both
circuit models.

| f (Hz) | WinISD, on − off (dB) | OpenISD, gyrator − winisd (dB) | residual |
| -----: | --------------------: | -----------------------------: | -------: |
|    200 |                +0.366 |                         +0.343 |   −0.023 |
|   1000 |                −1.212 |                         −1.040 |   +0.172 |
|   2000 |                −4.152 |                         −3.780 |   +0.372 |
|   5000 |               −10.617 |                        −10.091 |   +0.526 |
|  10000 |               −16.373 |                        −15.815 |   +0.558 |
|  20000 |               −22.314 |                        −21.758 |   +0.556 |

Trace resolution is 0.046 dB per pixel over that axis, so 0.56 dB is 12 px — far outside
trace noise. The residual is flat from 5 kHz up, which rules out a slope difference and
points at a constant factor in the coil impedance.

## Cause

Confirmed 2026-09-26 by decompile plus a BL sweep. Details are in `winisd_research/GHIDRA_FINDINGS.md`
§"VCInd".

- WinISD turns Le into an acoustic compliance `CLe = Sd²·Le/BL²` (`0x45e3ea`) using the
  **entered BL**.
- The source resistance it sits across, `Rae = 1/(2πFs·Qes'·Cas)`, uses **no BL**. It comes from
  Qes, Fs and Vas, with `Qes' = Qes·(Re+Rg)/Re`.
- The corner is `Rae·CLe = Le·(BL_Qes/BL)²/(Re+Rg)`, where `BL_Qes` is the BL implied by
  Fs/Qes/Vas/Re.
- The W5-1138SMF's entered BL is 7.17, but its Fs/Qes/Vas/Re imply 7.3838. That makes the
  factor ×1.0605, which is the 0.56 dB.

OpenISD uses one BL for both, so it gives the textbook `|Re+Rs+jωLe|/(Re+Rs)`. The two agree
whenever the driver's BL is consistent with its Qes/Fs/Vas/Re.

WinISD captures (`winisd_research/runs/vcind_bl/`), 20 kHz on−off:

| BL | WinISD observed | textbook |
| --: | --: | --: |
| 5.0 | −28.55 dB | −21.76 dB |
| 7.17 | −22.31 dB | −21.76 dB |
| 7.3838 | −21.80 dB | −21.76 dB |

The WinISD model above has no free parameters. It reproduces all three BL values from 200 Hz to
20 kHz within ≤0.067 dB, which is about 1.5 trace pixels.

## Fix

This is a modelling choice, not an arithmetic slip in OpenISD. WinISD uses two different BLs
for one driver: the entered BL for the Le element, and the Qes-implied BL for everything else.
The ruling is John's:
- (a) match WinISD by building the Le element from the entered BL and the source resistance
  from Qes, or
- (b) keep the textbook model and record the gap as a WinISD quirk.

It only shows on drivers whose entered BL disagrees with their Qes/Fs/Vas/Re.

## Verification

A unit test over this driver asserting OpenISD's gyrator-minus-winisd delta matches the
traced WinISD column at 1, 2, 5, 10 and 20 kHz within trace resolution.
