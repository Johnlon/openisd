# BUG_20261001_transfer-function-jumps-80db-where-spl-drops-below-190db

**Status:** RESOLVED

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
Silence is the exact −200 dB sentinel (`SILENCE_DB`, `isSilence`), private to `SimulationEngine.ts`.
Every "≤ −190" threshold is gone: `tfMag`, `passbandRef`, force flat, the WinISD driver-count gain.
The UI's `realDb` in `series.ts` is replaced by `engine.simulation.realLevels(db)`, and its −200
fills by `engine.simulation.silentCurve(n)`. The value written is unchanged (−200), so saved files, share links and the store carry
the same numbers as before; −Infinity was rejected because JSON writes it as `null`.

What WinISD writes for silence in a `.wpr` export is ⚠ unverified.

## Verification
- `packages/design/test/engine/tf-silence.test.ts`: realLevels, silentCurve, and a sealed sweep
  through LP Butterworth n=10 fc=50 Hz — TF falls without a step, passband reference, force flat,
  driver count. The sweep tests fail with the old −190 threshold put back in `isSilence`.
- `packages/ui/test/logic/series-multi-design.test.ts`: TFMag and SPL y-range reach the lowest real
  point. Both fail with the old threshold in `realDb`.
