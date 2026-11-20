# BUG_20261120_isobarik-impedance-motional-term-doubled

**Status:** OPEN

## Symptom
With Iso-Barik loading and "Two-BL driver" unticked (the default), the impedance chart's peak is about twice as high above Re as
the pair model gives: an Iso-Barik pair in half the box shows 35.4 ohm at 66 Hz where one driver in the whole box, which the
pair's model makes identical in impedance, shows 19.4 ohm.

## Evidence
Found by the driver-array physics rules test (T939, rule R4 Iso-Barik pair). OpenISD's pair is Mms x 2, Cms / 2, Rms x 2,
BL x sqrt 2 with Re and Le unchanged (`isobarikPair`); in half the box every mechanical impedance doubles, so the motional
impedance BL^2 / Zm is unchanged and the pair's impedance equals one driver's in the whole box.
Sealed W5 fixture, 1 driver, winisd circuit model, every switch off:

| f (Hz) | pair in half the box, ohm | one driver in the box, ohm |
| ------ | ------------------------- | -------------------------- |
| 66.2   | 35.39                     | 19.37                      |

Every box type, 51 of 57 switch combinations (all those with "Two-BL driver" unticked) for sealed, vented, both bandpasses and ABC.
With "Two-BL driver" ticked the impedance agrees.

## Cause (suspected)
`circuit.ts` doubles the motional term for Iso-Barik (`cScale(motional, 2)`, fitted to WinISD's `runs/sealed-w5-isobarik`
with "Two-BL driver" ticked), where the motional term uses `BlPush`. With the switch ticked `BlPush` is the typed BL of one
driver, so the x 2 makes it the pair's (sqrt 2 BL)^2. With it unticked `BlPush` is already the pair's sqrt 2 x BL, and the x 2
counts the pair twice. Same family as review finding 1 (Iso-Barik +3.01 dB with BL blank).

## Tests
`packages/design/test/engine/driver-array-physics-rules.test.ts`: the "(impedance)" part of R4 runs as `it.fails` naming this file.
