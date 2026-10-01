# BUG_20261001_transfer-function-jumps-80db-where-spl-drops-below-190db

**Status:** OPEN

## Symptom
Transfer function magnitude chart jumps up ~80 dB part-way down a steep roll-off, then keeps
falling. John's screenshot 2026-10-01: Butterworth LP n=10, fc=50 Hz; the trace falls to about
−270 dB, steps up to about −190 dB near 1.1 kHz, then falls again.

## Evidence
- The filter alone is smooth through the step: `ButterworthFamily(10).lowpass(f/50)` gives
  −264.4 / −268.5 / −272.3 dB at 1050 / 1100 / 1150 Hz (scratch tsx run).
- `tfMag()` (`packages/design/engine/simulation/SimulationEngine.ts:79`) subtracts the 0 dB
  reference only when `v > SILENCE_DB` (−190); at or below −190 it passes the absolute SPL through
  unreferenced.
- The step lands at −190 on the chart and its height equals the reference (`splRefLimit`, about
  +80 dB SPL here): above the step the trace is `spl − ref`; below it the trace is `spl`.

## Cause
There are two kinds of SPL at or below −190 dB: the −200 sentinel the sweep writes when |p| = 0
exactly, and real, finite levels from a steep filter. `tfMag()` treats every SPL at or below −190 as
the sentinel, so a real SPL below −190 skips the reference subtraction. The force-flat loop
(`spl[i] <= SILENCE_DB`, same file) and `realDb` in `packages/ui/src/logic/series.ts` use the
same threshold, so they also drop real levels below −190.

## Fix
Make silence distinguishable from a real level: write `-Infinity` (or a typed absence) where
|p| = 0, rather than −200, and stop using the −190 threshold. Then `tfMag` subtracts `ref` from
every finite value.

## Verification
Unit test: `tfMag` on a sweep through LP Butterworth n=10 fc=50 Hz is monotonic falling above
fc, with no step. The browser chart for the screenshot's project shows no step.
