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
⚠ unverified: WinISD appears to plot the impedance of one driver of the array (each in its share
of the box) and to use a different drive split. Its Nd model is not decoded yet; `d=1` in `[Box]`
is a candidate wiring key.

## Fix
Decode WinISD's Nd handling (sealed routine `0x4618f0`), fit runs/sealed-w5-nd2 exactly, match it by
default.

## Verification
Fixture from runs/sealed-w5-nd2; engine test ≤ 1e-12 on impedance, SPL, TF, max power.
