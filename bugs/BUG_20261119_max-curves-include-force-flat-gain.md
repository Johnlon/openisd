# BUG_20261119_max-curves-include-force-flat-gain

**Status:** FIXED (T936)

## Symptom
With "Force flat response" ticked, the Maximum SPL chart reads 2.4-4.2 dB louder below 45 Hz and Maximum power drops to 0.03 W at 10 Hz (W5, 4.48 L sealed), where WinISD's two curves do not change.

## Evidence
Found by the Gemini (agy) engine review, checked 19 Nov 2026. W5 test driver (Fs 45 Hz, Qts 0.49, Vas 4.85 L, Sd 94 cm2, Xmax 9.25 mm, Pe 40 W), 4.48 L sealed, 10-1000 Hz, 400 points:

| f (Hz) | max SPL off | max SPL on | max power off | max power on |
| ------ | ----------- | ---------- | ------------- | ------------ |
| 10     | 63.36       | 65.77      | 40.00         | 0.03         |
| 20     | 75.60       | 78.86      | 40.00         | 0.64         |
| 45     | 89.18       | 93.40      | 40.00         | 18.20        |
| 1000   | 96.81       | 96.82      | 40.00         | 40.00        |

- The EQ sits before the amplifier and cannot change what the driver can take: max SPL above the 40 W thermal limit is impossible.
- WinISD: the sealed chart routine `f_4618f0` (`winisd_research/re_ghidra/dumps/chart_point_4619e0.out`) never reads the FlatResponse byte (`param_2+0x51`) in the Maximum power branch (chart byte 11) or the branch it shares with Maximum SPL (byte 14); it reads it only for SPL (byte 13) and excursion (byte 8). No WinISD capture of max SPL with force-flat on exists; this rests on the decompiled code.

## Cause
`SimulationEngine.maxCurves` sweeps with the caller's parameters, `forceFlatResponse` included, so the flattened excursion set the Xmax limit.

## Fix
`maxCurves` turns `forceFlatResponse` off for its sweep, as it already drops the filter chain (BUG_20260927_max-spl-and-max-power-include-the-filter-chain). The SPL, excursion and port-velocity charts keep the force-flat gain.

## Tests
`packages/design/test/domain/max-curves-ignore-force-flat.test.ts`: force-flat on and off give identical max SPL, max power and Xmax marks (40 W at 10 Hz); the SPL chart still shows the gain.
