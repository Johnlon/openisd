# BUG_20261120_isobarik-pair-with-two-bl-driver-6db-below-one-driver

**Status:** OPEN, John's call whether it is WinISD's own result reproduced by the "Two-BL driver" bug switch

## Symptom
With Iso-Barik loading and "Two-BL driver" ticked, the pair in half the box plays 6.02 dB below one driver in the whole box at
the same voltage, and its excursion is half; unticked it is 3.01 dB below with excursion / sqrt 2, which is what the pair model
gives. With the winisdGyrator circuit model the phase, group delay and transfer function also differ.

## Evidence
Found by the driver-array physics rules test (T939, rule R4 Iso-Barik pair). OpenISD's pair is Mms x 2, Cms / 2, Rms x 2,
BL x sqrt 2, Re unchanged: in half the box the cone velocity solves to v / sqrt 2 exactly, so SPL - 3.0103 dB.
Sealed W5 fixture, 1 driver, winisd circuit model, only "Two-BL driver" ticked:

| f (Hz) | pair in half the box, dB | one driver in the box, dB | rule (one - 3.01), dB |
| ------ | ------------------------ | ------------------------- | --------------------- |
| 20.8   | 74.77                    | 80.79                     | 77.78                 |

Every box type, the 6 switch combinations with "Two-BL driver" ticked.

## Cause (suspected)
With "Two-BL driver" ticked the motor's push is the typed BL, which `isobarikPair` leaves at one driver's ("The typed BL (the
motor's push) stays one driver's", fitted to WinISD's `runs/sealed-w5-isobarik`, whose test runs with the switch ticked), while
the damping uses the pair's sqrt 2 x BL. So this may be WinISD's own Iso-Barik result, reproduced on purpose by the bug switch;
review finding 1 (BL left blank gives +3.01 dB) is the same split seen from the other side. Whether the rule should exempt the
bug switch, or the switch is wrong for Iso-Barik, is John's decision; no agent exempts it.

## Update after T928 (20 Nov 2026, 01:35 UTC)
T928 ("Iso-Barik push BL taken from one driver (default SPL was 3.01 dB high)") made the default (switch unticked) do the same
as ticked. The R4 "(response)" part now misses in every combination, ticked or not: the pair in half the box is 6.02 dB below
one driver in the box (rule: 3.01 dB) and its excursion is one half (rule: 1 / sqrt 2). Sealed W5, winisd circuit model,
every switch off, 15.4 Hz: pair 69.78 dB, one driver 75.80 dB, rule 72.79 dB. The 258 unticked cases (51 per box for 5
boxes, 3 for the passive radiator) are plain red tests; no agent has marked them.

WinISD's own captures give the pair 6.03 dB below one driver at the same drive. `packages/design/test/fixtures/
winisdIsobarikNd1StdCapture.ts` and `winisdIsobarikNd1IsoCapture.ts` (winisd_research runs/isobarik-more-20261119, the same
`sealed-w5-isobarik.wpr`, 4.48 L, P 1 W, the box the same for both), SPL chart:

| f (Hz) | one driver (dB) | Iso-Barik pair (dB) | difference (dB) | impedance one / pair (ohm) |
| ------ | --------------- | ------------------- | --------------- | -------------------------- |
| 199.8  | 80.505          | 74.273              | -6.232          |                            |
| 398.7  | 80.535          | 74.449              | -6.086          |                            |
| 1998.9 | 80.531          | 74.500              | -6.031          | 3.40320 / 3.40320          |

Above the box's influence (mass-controlled, the box volume no longer matters) the gap is the pair's own: 6.03 dB, at equal
impedance, so equal voltage. That is WinISD's Iso-Barik model, and both Iso-Barik WinISD tests run with "Two-BL driver"
ticked (`packages/design/test/engine/isobarik-power-winisd.test.ts:49`, `isobarik-loading-winisd.test.ts:21`,
`project.winisdDriverModel.set(true)`). So R4's -3.01 dB / excursion / sqrt 2 is the pre-T928 OpenISD model, not WinISD's.
Whether R4's expectation changes to WinISD's -6.02 dB / one half, or stays as physics with OpenISD behind a switch, is John's
decision.

## Tests
`packages/design/test/engine/driver-array-physics-rules.test.ts`: the "(response)" part of R4 for those rows runs as `it.fails`
naming this file.
