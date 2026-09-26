# BUG_20260926_winisd-impedance-uses-entered-bl

**Status:** RESOLVED

## Symptom

With "WinISD driver model" on, OpenISD's impedance peak on the W5-1138SMF sealed project is
1.23 Ω above WinISD's.

## Evidence

Fresh capture `winisd_research/runs/sweep-w5-sealed-fresh-20260926`;
`winisd_research/toys/w5_fresh_model_check.py` reproduces WinISD's complex impedance to 2e-14 Ω
with

    Z = Re + (BL²/Sd²) / (Ras + jωMas + 1/(jωCas) + Zbox)      BL = the entered 7.17

OpenISD's |Z| is reproduced to 2e-14 Ω by the same form with the Qes-derived BL (7.384).
Of the 1.23 Ω, (7.384/7.17)² is the BL part; the rest is the box absorption
(BUG_20260926_winisd-box-absorption-is-series).

## Cause

There are two BLs, the entered one and the Qes-derived one. WinISD's impedance uses the entered
one, OpenISD's uses the Qes-derived one. We need the entered one under the switch, as the push
already does.

## Fix

`circuit.ts`: the motional impedance (`Zmot`/`Zel`) uses `BL_entered_Tm`; the damping (`ZaE`)
keeps `BL_terminal_Tm`. Switch off: both are the entered BL, unchanged.

## Verification

Unit test: entered BL 7.17 → 5.0 scales (|Z| − Re) at every frequency by (5/7.17)² when the
electrical term is excluded; the W5 peak matches the fresh capture.

Fixed 2026-09-26: `circuit.ts` `Zel` uses `BlPush` (the entered BL). `winisdDriverModel.test.ts`: the W5 |Z| at 65.36 Hz is WinISD's 18.620133 Ω (red before: +0.922 Ω); the two older tests that expected the entered BL to leave impedance alone now expect Z − Re to scale by BL². Fresh-capture compare after the fix: |Z| within 3e-14 Ω.
