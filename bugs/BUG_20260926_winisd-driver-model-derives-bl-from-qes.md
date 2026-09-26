# BUG_20260926_winisd-driver-model-derives-bl-from-qes

**Status:** OPEN

## Symptom

There are two BLs for the W5-1138SMF, the entered 7.17 Tm and the 7.384 Tm that Qes implies.
WinISD's motor force follows the entered one; OpenISD's "Use WinISD driver calculations"
derives it from Qes. OpenISD is 0.27 dB loud, 3 % long in excursion and 1.2 Ω high on the
impedance peak because of it.

## Evidence

Baseline chart-review record, refreshed 2026-09-26 against `88e30dd6`
([CHART_REVIEW_WINISD_VS_OPENISD.md §4.1](http://localhost:8000/winisd/openisd/docs/research/CHART_REVIEW_WINISD_VS_OPENISD.md?html)).
Three observables, each independent, all matching the single ratio 7.384 / 7.17 = 1.0299:

| Observable             | OpenISD − WinISD          | The BL ratio predicts |
|------------------------|---------------------------|-----------------------|
| SPL, 300 Hz – 20 kHz   | +0.2719…+0.2758 dB (flat) | +0.256 dB             |
| Cone excursion at 1 Hz | +2.99 %                   | +2.99 %               |
| Z peak height          | +1.225 Ω (19.856/18.631)  | higher                |

Fc matches to the bit (65.0489 Hz both), so Cms, Mms and Rms agree — BL is the one term left.

## Cause

`driverSolverParamsOf` in `packages/design/domain/openisdDomain.ts` substitutes
`winisdBLterminal_Tm(...)` = √(2πFs·Mms·Re/Qes) for the terminal BL when the flag is set
(`ece3d3b6`). The entered BL survives only as `BL_entered_Tm`, which scales `CLe`.

⚠ unverified — the claim about WinISD is read off its curves, not out of its memory. Forcing
OpenISD's derived BL to 7.17, by entering the Qes that implies it (0.604534), moves the passband
from +0.272 dB to +0.017…+0.057 dB and the Z peak from 19.856 to 18.916 Ω against WinISD's
18.631. That run also moves the electrical damping, so it is not the experiment WinISD ran:
what WinISD does with entered BL and entered Qes together is the thing to read.

## Fix

Not decided until the debugger read lands. If WinISD's motor uses the entered BL, the
substitution set becomes Cms, Mms, Rms — BL entered, as it was before `ece3d3b6`, but with Cms
still from Vas.

## Verification

Refresh the chart review (§6 of it, about a minute, no wine). SPL, max SPL and cone excursion
should move inside tolerance; impedance should keep only whatever the peak-height residual
0.285 Ω turns out to be.
