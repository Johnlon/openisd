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

⚠ unverified for WinISD's side. OpenISD's roll-off is exactly first-order: at 20 kHz,
`20·log10(|Re + Rs + jωLe| / (Re + Rs))` = 21.758 dB, which is what `circuit.ts` produces
via `pg` and `ZaE` sharing one `Zcoil`. WinISD needs `|Z_on|/|Z_off|` about 6.6% larger to
reach 22.314 dB — consistent with it using a slightly different coil impedance in the
acoustic path (a different `Rs` placement, or an inductance term that is not the plain
`jωLe`), but which of those is not established.

## Fix

Not yet determined — the WinISD side has to be pinned down first. Next probe: sweep `Rg`
and `Le` independently under `VCInd=1` and see which one moves the residual, which
separates an `Rs`-placement difference from a different inductance term.

## Verification

A unit test over this driver asserting OpenISD's gyrator-minus-winisd delta matches the
traced WinISD column at 1, 2, 5, 10 and 20 kHz within trace resolution.
