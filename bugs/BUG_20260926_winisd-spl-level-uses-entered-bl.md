# BUG_20260926_winisd-spl-level-uses-entered-bl

**Status:** OPEN

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

## Cause

WinISD drives its circuit with the entered BL (level) while building the damping from Qes (shape),
the same mix as its `CLe` inductance element. OpenISD's "WinISD driver calculations" substitutes the
Qes-implied BL everywhere except `CLe`.

## Fix

With "WinISD driver calculations" on, scale the acoustic drive by `BL_entered / BL_derived`: the
level follows the entered BL, the damping stays Qes-derived. Unticked (conventional) keeps the
entered values throughout. ⚠ Unverified: whether WinISD's excursion, port velocity and max-SPL
charts scale the same way. They share the drive, so they should; check against a debugger run.

## Verification

- Unit test: the W5 at BL 7.17 vs 5.0 with the flag on, SPL differs by 20·log10(5/7.17) at
  every frequency.
- Unit test: W5 SPL at 1 kHz matches WinISD's 80.5315 dB to within the unexplained 0.016 dB.
