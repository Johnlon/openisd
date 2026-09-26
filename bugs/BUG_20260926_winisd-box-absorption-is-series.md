# BUG_20260926_winisd-box-absorption-is-series

**Status:** OPEN

## Symptom

With the WinISD loss model, OpenISD's sealed-box charts differ from WinISD's by small amounts
near resonance: SPL up to 0.043 dB, max SPL 0.14 dB, max power 1.0 W, group delay 0.19 ms,
impedance phase 1.6°.

## Evidence

Fresh WinISD capture `winisd_research/runs/sweep-w5-sealed-fresh-20260926` (W5-1138SMF, 4.48 L,
Ql 10, Qa 100, VCInd off, Rg 0.1, 1 W, every chart by debugger, unmodified exe).
`winisd_research/toys/w5_fresh_model_check.py` reproduces every WinISD chart from one closed
form: SPL, TF, excursion, impedance, max power and max SPL to ≤ 1e-13, group delay to 5e-7 s
(the numeric derivative). The same script reproduces OpenISD's SPL and |Z| to 3e-14.

WinISD's box impedance, solved exactly from its complex impedance chart:

    Zbox = Ral ∥ (Raa + 1/(jωCab))
    Ral  = Ql/(ωsc·Cab)          ωsc = 1/√(Mas·Cat)
    Raa  = ωsc·Mas/Qa            in series with Cab

OpenISD (`circuit.ts` 'winisd-lossy'): `Zbox = Zc ∥ Ral ∥ Qa/(ω·Cab)` — the absorption is a
frequency-dependent resistor in parallel.

## Cause

There are two absorption resistors, WinISD's and OpenISD's. WinISD's is ωsc·Mas/Qa in series
with the box compliance, OpenISD's is Qa/(ωCab) in parallel with it. We need WinISD's under
'winisd-lossy'.

## Fix

`circuit.ts` 'winisd-lossy' sealed: `Zbox = Ral ∥ (ωsc·Mas/Qa + Zc)`. The leak subtraction
(`U0 = UD − UD·Zbox/Ral`) already matches WinISD. The other loss modes stay as they are.

## Verification

Unit test: the W5 project's SPL, max SPL and complex impedance match the fresh capture's values
at resonance to 1e-6.
