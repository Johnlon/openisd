# BUG_20260927_max-spl-and-max-power-include-the-filter-chain

**Status:** RESOLVED

## Symptom

With filters on, OpenISD's Maximum SPL and Maximum power charts differ from WinISD's. Sealed W5
with a 4-filter chain (Linkwitz transform, Butterworth HP4 18 Hz, PEQ −4 dB, DLP): max SPL at
1 Hz WinISD 10.96 dB, OpenISD −69.5 dB; max power at 21.6 Hz WinISD 40 W, OpenISD 3.94 W. Every
other chart matches to ~1e-13.

## Evidence

- Capture `winisd_research/runs/filt-chain-sealed-1` (gdb PlotLogger, plotted values), compared
  by `winisd_research/toys/chart_plot_compare.py` against the OpenISD sweep of the same `.wpr`.
- WinISD's plot code `f_46bd30` multiplies the filter response Hf into plot kinds
  1,2,4,5,9,10,11,12,15,21 and never into kind 7 (Maximum power) or 16 (Maximum SPL)
  (winisd_research `GHIDRA_FINDINGS.md` "EQ/Filter chain").
- `packages/design/engine/sweep.ts` `maxCurves`: sweeps with `P.filters`, so the Pe-limited
  branch carries |Hf| into max SPL and the Xmax-limited branch divides it into max power.

## Cause

There are two max-curve inputs, WinISD's and OpenISD's. WinISD's is the driver in its box alone;
OpenISD's includes the filter chain. Drop the filter chain from `maxCurves`.

## Fix

`maxCurves` sweeps with `filters: []`.

## Verification

Done: `filter-chain-charts.test.ts` "maximum SPL and maximum power leave the filter chain out" (RED then green). Compare on
`filt-chain-sealed-1`: max SPL 2.8e-14 dB, max power 8.9e-14 W — all 11 charts match.
