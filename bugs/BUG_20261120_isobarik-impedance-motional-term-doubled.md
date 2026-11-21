# BUG_20261120_isobarik-impedance-motional-term-doubled

**Status:** FIXED (T928, "Engine: Iso-Barik push BL taken from one driver")

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

## Fix
T928 takes the Iso-Barik push BL from one driver whether BL is typed or not, so the motional term's x 2 now makes the pair's
(sqrt 2 BL)^2 in both switch states.

## Tests
`packages/design/test/engine/driver-array-physics-law-combinations.test.ts`: after main with T928 was merged into T939 (20 Nov 2026,
01:35 UTC), every "(impedance)" case of R4 that named only this file passes at 1e-9 relative (impedance) and 1e-9 rad
(impedance phase) and now runs as a plain test: all 57 combinations for sealed, vented, both bandpasses and ABC, and the 3
passive-radiator combinations with "PR Npr resonance" ticked. The other passive-radiator impedance cases still miss by about
6 % and stay `it.fails` under BUG_20261120_passive-radiator-box-losses-not-scaled-with-radiator-count.
