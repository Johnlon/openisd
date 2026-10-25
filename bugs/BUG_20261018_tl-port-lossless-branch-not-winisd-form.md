# BUG_20261018_tl-port-lossless-branch-not-winisd-form

**Status:** FIXED (T430)

## Symptom
With the TL port tickbox on and Ql and Qa both at 1e6 (lossless), OpenISD's charts differ from
WinISD's by up to 27 % in impedance (30-50 Hz) and by whole dB in SPL near the tuning and the pipe
resonances. With any loss below 1e6 they match to 1e-11.

## Cause
There are two port models in the engine, `lossless` and `winisd-lossy`. Ql and Qa both >= 1e6 picks
`lossless`, which builds its own line (`portImpedance`: tanh with Qp loss, mouth radiation, end
correction kept, the no-end-correction switch ignored). WinISD uses the same fixed-resistance tan
form with and without losses. We need the TL-on lossless case to use the WinISD form.

## Evidence
winisd_research `runs/vented-w5-tlports-lossless` (57f444e) against OpenISD: worst relative errors
SPL 1.4e+1 (4 Hz), impedance 2.7e-1, port velocity 4.8, TF 1.0e+2. The same project with Ql = Qa =
999999.9999 (the `winisd-lossy` branch): SPL 3e-14, impedance 4e-15, port velocity 3e-12, TF 3e-11.
Figures: `docs/research/TL_PORT_MODEL.md`, section T389.

## Not a WinISD difference
No yellow switch and no register row: OpenISD is wrong, WinISD is consistent.

## Fix (T430)
`engine/circuit.ts`: a vented box with the TL port model on takes the `winisd-lossy` form even at
Ql = Qa >= 1e6. Pinned by the lossless case in `test/engine/tl-port-model-winisd.test.ts`
(`runs/vented-w5-tlports-lossless`). TL off keeps the `lossless` branch (no capture).
Untested, no capture, unchanged: the bp4, bp6, ABC and passive-radiator `lossless` branches with TL on.
