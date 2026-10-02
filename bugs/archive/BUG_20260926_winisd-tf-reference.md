# BUG_20260926_winisd-tf-reference

**Status:** RESOLVED

## Symptom

OpenISD's transfer-function magnitude on the W5-1138SMF sealed project is 0.49 dB below
WinISD's at every frequency.

## Evidence

Fresh capture `winisd_research/runs/sweep-w5-sealed-fresh-20260926`;
`winisd_research/toys/w5_fresh_model_check.py`: WinISD's TF = SPL − 20·log10(ρ·Pg/(2π·Mas)/20 µPa)
to 1e-14 dB, with Pg = eg·BL/(Sd·(Re+Rg)), BL the entered one. That is the HF asymptote of the
lossless circuit's own push.

OpenISD's reference (`sweep.ts` `splRefLimit`) is η₀ from Fs, Vas, Qes with eg²/Re. It sits
+0.507102 dB above WinISD's = 20·log10(BL_Qes/BL) + 20·log10((Re+Rg)/Re), exact.

## Cause

There are two TF references, WinISD's and OpenISD's. WinISD's is the circuit's HF asymptote from
the entered BL and Re+Rg; OpenISD's is η₀ from Qes and Re. We need WinISD's under "WinISD driver
model".

## Fix

`circuit.ts` `hfAsymptotePressure_Pa`: ρ·|pg|/(2π·r·Mas), the lossless circuit's HF asymptote with
the entered BL and the circuit's own coil resistance (Re + Rg). `sweep.ts` uses it as the TF
0 dB for every driver, switch on or off: it is the asymptote the chart is defined against, and
equals η₀'s level whenever the driver is consistent and Rg is 0. The `hfPassbandRef` fallback
(for drivers without Fs/Vas/Qes) is gone: the asymptote always exists.

## Verification

- `winisdDriverModel.test.ts`: the W5 TF at 998.56 Hz is WinISD's −0.015566 dB (red before:
  +0.507 dB off).
- `sweep.test.ts`: a lossless sealed sweep without Le reaches 0 dB at 20 kHz.
- Fresh-capture compare after the fix: TF magnitude within 3e-14 dB at all 2086 points.
