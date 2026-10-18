# BUG_20261018_tl-port-lossless-branch-not-winisd-form

**Status:** OPEN (found by T389; fix not yet made)

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
