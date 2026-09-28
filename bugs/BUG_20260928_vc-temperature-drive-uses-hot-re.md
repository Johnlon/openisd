# BUG_20260928_vc-temperature-drive-uses-hot-re

**Status:** OPEN

## Symptom
With a voice-coil temperature rise, OpenISD's SPL is 0.32 dB below WinISD's, its excursion is
lower, and its maximum power is 7.6 % higher. Impedance and TF still match.

## Evidence
winisd_research runs/sealed-w5-dtvc20 (W5 sealed, `dTVC=20`, alfaVC 0.0039, Rg 0.1,
2026-09-28) against OpenISD with `vcTempRise_K` 20: impedance 3.2e-14 Ω and TF 2.1e-14 dB (both
match). SPL is off by 0.317 dB, excursion by 0.069 mm at 1 Hz, and max power by 2.81 W (WinISD
37.071, OpenISD 39.880). 39.880/37.071 = 1.07577 = (Re_hot + Rg)/(Re + Rg) = (3.4·1.078 + 0.1)/3.5.

## Cause
OpenISD derives the drive (power reference and max power) from the hot Re; WinISD derives it
from the cold, entered Re, and uses the hot Re only in the circuit.

## Fix
Match WinISD by default: drive level and max power from the entered Re; the hot Re stays in the
circuit. Record the conventional form as a candidate switch in ACCURACY_IMPROVEMENTS.md.

## Verification
Fixture from runs/sealed-w5-dtvc20; engine test ≤ 1e-12 on SPL, excursion, max power.
