# BUG_20260928_driver-count-not-winisd

**Status:** OPEN

## Symptom
With two drivers (`[Box] Nd=2`) OpenISD's charts differ from WinISD's, with either wiring.
WinISD's impedance for the W5-1138SMF sealed case is 16.83 Ω at 80 Hz. OpenISD shows 8.41 Ω with
parallel wiring and 33.65 Ω with series wiring. SPL differs by about 3 dB and maximum power by
35–38 W.

## Evidence
winisd_research runs/sealed-w5-nd2 (W5 sealed 4.48 L, `Nd=2`, `d=1`, 2026-09-28) against OpenISD
with `nDrivers` 2:

| OpenISD wiring | Impedance (80.2 Hz) | SPL worst | TF worst | Max power worst |
|----------------|--------------------:|----------:|---------:|----------------:|
| parallel       | 8.41 Ω (WinISD 16.83) | 2.96 dB | 0.196 dB | 37.7 W |
| series         | 33.65 Ω (WinISD 16.83) | 2.99 dB | 0.101 dB | 34.8 W |

WinISD's impedance is the geometric middle of the two, i.e. one driver's impedance.
runs/sealed-w5-med5g (Med alone) matches to 7e-14, so the difference is the count.

## Cause
Decoded 2026-09-29 by fit against runs/sealed-w5-nd2. WinISD treats N drivers as N copies of one
driver, each in Vb/N and each fed P/N:

| Chart           | WinISD with Nd = N                               | Fit to capture   |
|-----------------|--------------------------------------------------|-----------------:|
| Impedance, TF   | one driver in Vb/N                               | 3e-14 abs        |
| SPL             | one driver in Vb/N at P, + 10·log10(N)           | 7e-14 relative   |
| Excursion       | one driver in Vb/N at P, ÷ √N (per-driver P/N)   | 2e-12 relative   |
| Maximum power   | one driver in Vb/N, × N                          | 2e-15 relative   |

OpenISD instead wires the N coils (parallel/series) into one terminal impedance with Sd×N. That
wiring model has no WinISD counterpart.

## Fix
WinISD's model by default. OpenISD's wiring model moves behind its own WinISD Compatibility
switch ("WinISD driver-count model"), per the native-by-default rule. Not captured yet: maximum
SPL, amplifier VA, ported boxes.

## Verification
Fixture from runs/sealed-w5-nd2; engine test ≤ 1e-12 on impedance, SPL, TF, max power.
