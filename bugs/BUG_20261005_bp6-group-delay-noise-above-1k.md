# BUG_20261005_bp6-group-delay-noise-above-1k

**Status:** FIXED 2026-10-05

## Symptom
OpenISD's own group delay chart is noisy above ~1.2 kHz on the 6th-order bandpass (W5-1138SMF,
`bp6-w5-base2`): point-to-point jumps of up to 0.16 ms on a curve of ~0.01–0.09 ms (1.24 kHz:
0.0344 ms, exact 0.0178 ms; 8.3 kHz: −0.0042 ms). Every other box carried a 3e-4 ms staircase.

## Cause
The group delay central difference stepped a fixed f ± 1e-10 Hz (WinISD's step), which divides
the response's rounding error by 2π·2e-10 Hz; the 6th-order bandpass H carries ~2e-13 rad of
rounding above 1 kHz, so the derivative is noise.

## Fix
[SimulationEngine.ts](http://localhost:8000/winisd/openisd/packages/design/engine/simulation/SimulationEngine.ts)
`groupDelayAtMs` steps f·(1 ± 1e-6) (floor 1e-10 Hz). Shared by every box type and the EQ/filter
chain group delay.

## Verification
[group-delay-smooth.test.ts](http://localhost:8000/winisd/openisd/packages/design/test/engine/group-delay-smooth.test.ts):
second difference on WinISD's 2086-point grid above 1.2 kHz < 1e-5 ms for BP6, ABC, BP4, sealed,
vented and PR. Before: BP6 0.163 ms, others 3e-5 to 1.3e-4 ms. After: BP6 1.8e-7 ms. BP6 at
1.24 kHz now 0.01776 ms (exact 0.0178). WinISD group delay parity tests unchanged and passing;
golden-master `gd` arrays regenerated (moved by ≤ 1.6e-3 ms, the old staircase; nothing else moved).
