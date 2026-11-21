# BUG_20261120_isobarik-pair-with-two-bl-driver-6db-below-one-driver

**Status:** OPEN, John's call: R4's expectation (-3.01 dB) against WinISD's -6.02 dB, and against the physical pair T942 made the default

## Symptom
With Iso-Barik loading as WinISD's numbers (winisdIsobarik true, or a save from before T942), whatever the "Two-BL driver"
switch says, the pair in half the box plays 6.02 dB below one driver in the whole box at the same voltage, and its excursion is
one half. R4 expects 3.01 dB below and excursion / sqrt 2, the pair's model: Mms x 2, Cms / 2, Rms x 2, BL x sqrt 2, Re unchanged.
Sealed W5, winisd circuit model, every switch off, 15.4 Hz: pair 69.78 dB, one driver 75.80 dB, rule 72.79 dB.
The physical pair (T942's default, winisdIsobarik false, wired as the project's wiring) gives 0 dB wired parallel and -6.02 dB
wired series (`driver-array-physics-rules.test.ts`): neither is R4's -3.01 dB either.

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
`packages/design/test/engine/driver-array-physics-law-combinations.test.ts`: the "(response)" part of R4 in every combination (258 cases, 6 boxes) runs as `it.fails`
naming this file.
