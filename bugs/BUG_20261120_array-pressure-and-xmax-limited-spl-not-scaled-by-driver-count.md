# BUG_20261120_array-pressure-and-xmax-limited-spl-not-scaled-by-driver-count

**Status:** OPEN

## Symptom
With 2 or more drivers, the Xmax-limited SPL ("SPL graph is Xmax limited") and the complex pressure the sweep returns are one
driver's: Xmax-limited SPL is 6.02 dB too low at 2 drivers and 9.54 dB too low at 3, in every box type and both wirings. The
plain SPL is right (+6.02 dB at 2 drivers).

## Evidence
Found by the driver-array physics rules test (T939, rule R1 parallel array and R2 series array): N drivers in N x the box at the
same voltage per driver must give N x the pressure and SPL + 20 log10 N, Xmax-limited SPL included.
Sealed W5 fixture (`sealed-w5-nd2.wpr` at 1 driver), 20 V, 5 Hz:

| Drivers | Xmax-limited SPL (dB) | should be (dB) | pressure real part (Pa) | should be (Pa) |
| ------- | --------------------- | -------------- | ----------------------- | -------------- |
| 1       | 50.97                 | 50.97          | -0.01051                | -0.01051       |
| 2       | 50.97                 | 56.99          | -0.01051                | -0.02102       |
| 3       | 50.97                 | 60.51          | -0.01051                | -0.03153       |

Same miss in all 6 box types, all 57 switch combinations, both loadings, parallel and series (684 + 684 cases).
This is finding 3 of the 19 Nov engine review (`_agent_files/reference/ULTRA_REVIEW_20261119_engine_findings.md`, workspace repo).

## Cause
`SimulationEngine.sweep`'s driver-count branch adds `20 log10 N` to `spl` and scales `va` and `zmag`, but returns the one
driver's `splXlimCurve` and `H` unchanged.

## Tests
`packages/design/test/engine/driver-array-physics-rules.test.ts`: the "(pressure)" part of R1 and R2 runs as `it.fails`
naming this file.
