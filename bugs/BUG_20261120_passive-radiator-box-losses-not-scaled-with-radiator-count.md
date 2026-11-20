# BUG_20261120_passive-radiator-box-losses-not-scaled-with-radiator-count

**Status:** OPEN

## Symptom
In a passive-radiator box with the "PR Npr resonance" bug switch unticked (the default), the box's leak and absorption losses do
not follow the radiator count: halving the box and the radiator count together (which halves every acoustic impedance's
admittance, so must leave the response shape unchanged) moves the SPL by 0.44 dB, the group delay at 5 Hz from 10.5 to 14.7 ms
and the phase by 0.16 rad. With the bug switch ticked it holds.

## Evidence
Found by the driver-array physics rules test (T939, rule R4 Iso-Barik pair: the pair in half the box, radiator count / 2, against
one driver in the box). PR W5 fixture (`pr-w5-1.wpr`), winisd circuit model, every switch off:

| f (Hz) | quantity       | pair in half the box | one driver in the box (rule) |
| ------ | -------------- | -------------------- | ---------------------------- |
| 5      | SPL (dB)       | 53.80                | 54.24 (one driver - 3.01 dB)  |
| 5      | group delay ms | 14.73                | 10.48                        |
| 5      | phase (rad)    | -2.979               | -3.138                       |

54 of 57 switch combinations; the 3 that hold have "PR Npr resonance" ticked (and, for the impedance, "Two-BL driver" too).

## Cause (suspected)
`PassiveRadiatorBox` (winisd-lossy) sets the fixed leak and absorption resistances from `wr * Map`, with `Map` ONE radiator's
acoustic mass. Unticked, `wr` is the physical tuning; the radiators' combined mass is `Map / Npr`, so the resistances are Npr
times too large for Npr above 1 (too small below). Ticked, WinISD's `wr` is Npr times lower, which cancels the per-radiator
mass and gives `Ql * wr_physical * Map / Npr`, the scaling the rule expects. A real project with 2 radiators and 1 driver is
affected the same way. Needs a WinISD capture with 2 radiators and losses before the fix (the existing ones are Nd 2, where
each driver's share is 1 radiator).

## Tests
`packages/design/test/engine/driver-array-physics-rules.test.ts`: the passive-radiator cases of R4 run as `it.fails` naming this file.
