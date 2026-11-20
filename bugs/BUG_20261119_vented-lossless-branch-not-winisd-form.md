# BUG_20261119_vented-lossless-branch-not-winisd-form

**Status:** FIXED (T937)

## Symptom
A vented box with Ql and Qa both at 1e6 (no losses) and the transmission-line port model off draws impedance up to
1.37 ohm (8.9 %) away from WinISD at 28.2 Hz and SPL 0.22 dB away at 30.9 Hz (8.7 dB at 1 Hz), at Qp 15. At the default
Qp 100: 0.44 ohm (2.1 %) at 28.3 Hz and 0.037 dB at 31.6 Hz. At Ql = Qa = 999999 it matches WinISD to 3e-14.

## Cause
`engine/circuit.ts` picks the `lossless` vented form when Ql and Qa are both >= 1e6 (TL port model off). That form builds
its own port (per-frequency mass from the vent's length and area, per-frequency leak and absorption). WinISD has one
vented form whatever Ql and Qa are: every loss a fixed resistance at the tuning Fb, the port mass from Fb.

## Evidence
winisd_research commit 780edb1, write-up `runs/vented-w5-tl0-ql1e6-qp15/RESULT.md`, runs
`runs/vented-w5-tl0-{ql1e6,ql999999}-{qp15,qp100}/`, sweep records `runs/sweep-vented-w5-tl0-*.json`, book
`spec/S06_vented_box.md` section 6. W5-1138SMF, 10 L, Fb 38 Hz, one 5 cm round port, Rg 0.1 not at driver side, 1 W,
`TLPorts=0`.

| comparison (Qp 15, all 2087 points)               | SPL dB  | impedance ohm |
| ------------------------------------------------- | ------- | ------------- |
| WinISD 1e6 against WinISD 999999                  | 4.9e-11 | 1.4e-10       |
| WinISD 1e6 against OpenISD fixed-loss form at 1e6 | 2.8e-14 | 4.6e-14       |
| WinISD 1e6 against OpenISD lossless branch        | 8.68    | 1.37          |

The TL-on half of the same split: `bugs/archive/BUG_20261018_tl-port-lossless-branch-not-winisd-form.md` (T430).

## Not a WinISD difference
No switch and no register row: OpenISD is wrong, WinISD is consistent (1e6 and 999999 give the same curves).

## Fix (T937)
`engine/circuit.ts`: a vented box always takes the `winisd-lossy` form, TL port model on or off. The vented `lossless`
case in `engine/boxes/VentedBox.ts` is no longer reached. Untested, no capture, unchanged: the sealed, bp4, bp6, ABC and
passive-radiator `lossless` branches at Ql = Qa >= 1e6.

## Tests
`packages/design/test/engine/vented-lossless-winisd.test.ts`: the two `.wpr` files at Qp 15 and Qp 100
(`packages/design/test/winisd/fixtures/vented-w5-tl0-ql1e6-qp{15,100}.wpr`), SPL and impedance at 12 grid points from 1 Hz
to 10 kHz (28.2 Hz and 30.9 Hz included) within 1e-12 relative of WinISD
(`packages/design/test/fixtures/winisdVentedTl0LosslessCapture.ts`). `packages/design/test/engine/boxModel.test.ts` gives
its vented case a tuning (Fb 38 Hz), which the fixed-loss form reads.
