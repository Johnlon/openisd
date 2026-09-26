# BUG_20260926_winisd-tf-reference

**Status:** OPEN

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

`sweep.ts`: with the switch on, the reference is 20·log10(ρ·Pg/(2π·Mas·r)/20 µPa) from the
circuit's own push; switch off keeps η₀.

## Verification

Unit test: the W5 project's TF at 998.56 Hz is WinISD's −0.0155662 dB to 1e-6.
