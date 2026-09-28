# BUG_20260928_vc-temperature-drive-uses-hot-re

(Name kept for links: it is WinISD that uses the hot Re; OpenISD uses the cold one.)

**Status:** RESOLVED

## Symptom
With a voice-coil temperature rise, OpenISD's SPL is 0.32 dB below WinISD's, its excursion is
lower, and its maximum power is 7.6 % higher. Impedance and TF still match.

## Evidence
winisd_research runs/sealed-w5-dtvc20 (W5 sealed, `dTVC=20`, alfaVC 0.0039, Rg 0.1,
2026-09-28) against OpenISD with `vcTempRise_K` 20: impedance 3.2e-14 Ω and TF 2.1e-14 dB (both
match). SPL is off by 0.317 dB, excursion by 0.069 mm at 1 Hz, and max power by 2.81 W (WinISD
37.071, OpenISD 39.880). 39.880/37.071 = 1.07577 = (Re_hot + Rg)/(Re + Rg) = (3.4·1.078 + 0.1)/3.5.

## Cause
WinISD takes the drive voltage from the HOT Re, eg = √(P·(Re_hot + Rg)), and plots max power as
V²/(Re_hot + Rg). OpenISD uses the entered (cold) Re in both: `projectSignal` `driveVoltage` and
`SimulationEngine.maxCurves` (`Re = drv.Re_terminal_ohm`). SPL 10·log10(1.07577) = 0.317 dB and
max power ×1.07577 are both that ratio.

## Fix
Use the hot Re (hotRe(Re, alfaVC, dTVC)) for the drive voltage and for max power.
Done: `DriverEngine.hotRe`; `OpenISDDriverEmbedded.hotRe_ohm` feeds the power ↔ voltage solve
(`usableRe`); `SimulationEngine.maxCurves` states max power into hot Re + Rs.

## Verification
Fixture from runs/sealed-w5-dtvc20 (`test/fixtures/winisdVcTempRiseCapture.ts`, project
`test/winisd/fixtures/sealed-w5-dtvc20.wpr`). `test/domain/vc-temperature-drive-winisd.test.ts`:
impedance, SPL and max power at all 131 plotted points ≤ 1e-12. Red before the fix (SPL
−2.948 vs −2.631 dB, max power 24.57 vs 22.84 W at 1 Hz), green after; design suite 2371/2371.
