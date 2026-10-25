# BUG_20261018_winisd-tl-port-no-end-correction

**Status:** RESOLVED (fixed by default; yellow switch "TL port without end correction" brings WinISD back)

## Symptom
Ticking WinISD's "Use transmission line model for port simulation" (Advanced tab, `TLPorts` in the
`.wpr`) retunes the box. The Box tab still says Fb 38 Hz. WinISD's own Fb readout contradicts its
own impedance chart.

## Evidence
winisd_research `runs/vented-w5-tlports` and `runs/vented-w5-tloff`, W5-1138SMF, 10 L, Fb 38 Hz:

| TL option | Impedance minimum |
|---|---:|
| off | 39.13 Hz |
| on (WinISD) | 40.26 Hz |
| on (OpenISD default) | 38.69 Hz |

WinISD's pipe is L = Map·S/ρ less the end correction, lighter than the Fb mass Map. OpenISD's pipe
keeps the end correction. It lands 0.4 Hz under the lumped minimum, not on it: the pipe's tan() is a
little heavier than the lumped mass.

## OpenISD
- Unticked (default): the pipe is Map·S/ρ long, the box tunes at Fb.
- Ticked: WinISD's pipe, matched to the captures (vented, 4th and 6th order bandpass, ABC) to 1e-11.
- Applies only with the TL tickbox on and a vented, bandpass or ABC box.
- A ≠W cue by the TL tickbox opens the "OpenISD and WinISD differences" entry (phone and desktop).
- Tests: `packages/design/test/engine/tl-port-end-correction.test.ts`,
  `packages/design/test/engine/tl-port-model-winisd.test.ts`,
  `packages/ui/test/ui/tl-port-difference-cue.browser.spec.ts`.
- Research: `docs/research/TL_PORT_MODEL.md`.
