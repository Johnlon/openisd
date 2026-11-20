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

## Tests
`packages/design/test/engine/driver-array-physics-rules.test.ts`: the "(response)" part of R4 for those rows runs as `it.fails`
naming this file.
