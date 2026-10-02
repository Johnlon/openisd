# BUG_20260926_winisd-spl-level-uses-entered-bl

**Status:** RESOLVED

## Symptom

With "WinISD driver calculations" on, OpenISD's SPL on the W5-1138SMF sealed project is 0.272 dB
above WinISD's at every frequency, with voice coil inductance on or off. The curve shapes agree;
only the level differs.

## Evidence

WinISD 0.7.0.950, unmodified, SPL chart values logged by the debugger (2086 points, VCInd off,
Rg 0.1 Ω, 1 W). Runs in `winisd_research/runs/`: `sweep-w5-sealed-baseline-charts` (BL 7.17) and
`sweep-w5-sealed-bl5-spl` (the same project with only the entered BL changed to 5.0; new `BL=`
option of `toys/w5_chart_refresh.py`).

| f (Hz) | WinISD BL 7.17 | WinISD BL 5.0 | difference | OpenISD (HEAD 638ba6dc) |
|-------:|---------------:|--------------:|-----------:|------------------------:|
|     20 |        59.3931 |       56.2621 |    −3.1310 |                         |
|    100 |        79.8304 |       76.6994 |    −3.1310 |                         |
|    999 |        80.5315 |       77.4006 |    −3.1310 |                 80.8035 |
|  20000 |        80.5304 |       77.3994 |    −3.1310 |                         |

- 20·log10(5/7.17) = −3.1310. WinISD's level scales exactly with the entered BL, at every
  frequency; the shape does not change.
- The shape (damping) comes from Qes, Fs and Vas: `Rae = 1/(2πFs·Qes'·Cas)`
  (`winisd_research/GHIDRA_FINDINGS.md` §VCInd). The level comes from the entered BL.
- OpenISD's HF level equals the textbook ρ·Sd·BL·e/((Re+Rg)·Mms·2π·r) with the BL implied by
  Fs/Qes/Vas/Re (7.384) and e = √(P·(Re+Rg)), to 0.001 dB.
- 20·log10(7.384/7.17) = 0.256 dB of the 0.272 dB gap. ⚠ The remaining 0.016 dB is not
  explained yet.

Inductance roll-off, same date: OpenISD's `winisdGyrator` on−off delta matches WinISD's to
0.001 dB from 20 Hz to 20 kHz. The earlier 0.42 dB came from the Cms-from-Vas gap, fixed in
ece3d3b6.

Two more charts carry the same ratio, from the refreshed chart review
([CHART_REVIEW_WINISD_VS_OPENISD.md](http://localhost:8000/winisd/openisd/docs/research/CHART_REVIEW_WINISD_VS_OPENISD.md?html) §4.1,
baseline record against `88e30dd6`):

| Observable             | WinISD  | OpenISD | OpenISD − WinISD | BL ratio predicts |
|------------------------|--------:|--------:|-----------------:|-------------------|
| Cone excursion at 1 Hz | 2.00638 | 2.06646 | +2.99 %          | +2.99 %           |
| Impedance peak         | 18.631  | 19.856  | +1.225 Ω         | (see below)       |

Excursion shares the drive, so the Fix below covers it. **Impedance does not.** Its peak height
is motional, ∝ BL²/Rms: peak − Re is 15.209 Ω for WinISD against 16.433 for OpenISD, a ratio of
1.0805 where BL² alone predicts 1.0605. Scaling the acoustic drive leaves this chart exactly
where it is, and the residual 1.9 % on top of BL² is unexplained.

Forcing OpenISD's derived BL to 7.17, by entering the Qes that implies it (0.604534), moves the
passband from +0.272 dB to +0.017…+0.057 dB and the Z peak from 19.856 to 18.916 Ω. That run
also moves the damping, so it is not WinISD's experiment — it only shows BL is the term.

## Cause

WinISD drives its circuit with the entered BL (level) while building the damping from Qes (shape),
the same mix as its `CLe` inductance element. OpenISD's "WinISD driver calculations" substitutes the
Qes-implied BL everywhere except `CLe`.

## Fix

Ruling, John 2026-09-26: the two-BL mix is one WinISD bug under one switch, "WinISD driver
calculations"; the separate "WinISD inductance model" checkbox is removed.

Level part fixed 2026-09-26:
- `circuit.ts`: the motor's push (`pg`) uses the typed BL (`BL_entered_Tm`); the damping (`ZaE`)
  keeps `BL_terminal_Tm`, which the switch makes Qes-derived. With the switch off both are the
  typed BL, so conventional results are unchanged.
- `sweep.ts`: `BL_entered_Tm` is the typed BL only. A calculated BL falls back to the damping BL,
  since WinISD's own calculated BL is the Qes-derived one.
- `openisdDomain.ts` `engineCircuitModel`: inductance on + switch on → WinISD's inductance model,
  switch off → textbook.

Residuals explained 2026-09-26 against the fresh capture `runs/sweep-w5-sealed-fresh-20260926`
(`winisd_research/toys/w5_fresh_model_check.py`, every chart to ≤ 1e-13):
- The passband 0.016 dB and the near-resonance 0.04 dB: box absorption,
  BUG_20260926_winisd-box-absorption-is-series.
- The impedance peak: BUG_20260926_winisd-impedance-uses-entered-bl.
- Excursion, max power and max SPL follow the typed BL in WinISD, confirmed; their residuals are
  the box absorption. Port velocity: sealed box, no port.

## Verification

- The impedance peak is a separate check: the drive-scaling fix must not be declared done on
  the SPL charts alone.
- `winisdDriverModel.test.ts` (red before the fix): typed BL 7.17 → 5.0 moves every SPL point
  by 20·log10(5/7.17) and leaves impedance alone; the W5 at 998.56 Hz is within 0.02 dB of
  WinISD's 80.5315 dB; inductance on with the switch on gives WinISD's −22.266 dB on−off at
  20 kHz, and with it off the textbook roll-off.
- `advanced-inductance.browser.spec.ts`: no separate inductance-model switch; the driver
  calculations tooltip names the inductance and the WinISD bug.
