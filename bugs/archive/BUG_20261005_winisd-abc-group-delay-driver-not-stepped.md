# BUG_20261005_winisd-abc-group-delay-driver-not-stepped

**Status:** RESOLVED

## Symptom

WinISD's ABC group delay chart disagrees with WinISD's own ABC phase chart. W5-1138SMF ABC
(abc-w5-gd2), group delay in ms:

| f (Hz)  | WinISD    | −dφ/dω of the plotted phase |
|--------:|----------:|----------------------------:|
| 1.00476 | −40.958473 | −33.858433                 |
| 1.60799 | −36.593869 | −29.495619                 |
| 10.7503 | −3.312989  | 3.622579                   |
| 115.570 | 1.457640   | 2.387217                   |
| 528.39  | 0.004460   | 0.055862                   |
| 1242.41 | 0.000795   | 0.010059                   |
| 3996.9  | 0.000149   | 0.000971                   |

A WinISD calculation bug (John, 2026-10-05): copied only behind a yellow error switch.

## Cause

Decoded bit for bit (winisd_research commit 864d53a, `GHIDRA_FINDINGS.md` "Group delay of the
6th-order bandpass and ABC — chart byte 12 (2026-10-05)"; `scratch/gd_x87.py`, `scratch/gd_bp6_abc.py`;
runs `abc-w5-gd1`, `abc-w5-gd2`). Case 12 of the ABC routine `0x4591b0` steps the box load
`0x45a0d0` to f' = f ± δ (δ = 1e-10 Hz), but the output routine `0x459f90` passes the chart
frequency f to the driver routine `0x45e660`:

    V(f') = A·X · Zx(f') / (Zx(f') + B)          A, X, B: the driver part at f, not f'
    H(f') = (V·Zf/(Zi+Zf)/Zcf + V/Zcr)(f') · jω(f)
    gd    = −∂φ/∂ω of the box alone

The driver's own phase slope is left out. BP4 and BP6 compute their output inline with f' and do
not have this.

## OpenISD

Correct by default: group delay is −dφ/dω of the plotted phase. The yellow error switch "Enable
WinISD ABC group delay bug" (`winisdAbcGroupDelay`, under "WinISD bugs", off by default, editable on
an ABC box only) brings WinISD's form back: `solve(f', …, fDriver = f)` in
`packages/design/engine/circuit.ts`, selected in `SimulationEngine.sweep`. While the switch is off on
an ABC box, a ≠W cue by the Group delay chart says what WinISD does
(`WinisdDeviation.ABC_GROUP_DELAY`).

## Verification

`packages/design/test/engine/abc-group-delay-winisd.test.ts`: off, the table's phase-slope column;
on, WinISD's column, both to 1.5e-3 ms (two 1e-10 Hz staircases of up to 7.3e-4 ms each). Over all
2082 points of abc-w5-gd2 the switch-on curve is within 1.03e-3 ms of WinISD (worst at 129.5 Hz).
`packages/design/test/domain/winisd-abc-group-delay.test.ts`: default, Reset to WinISD, save, old
file, ABC-only, chart cue. Browser: `original-advanced-tab.browser.spec.ts`,
`mobile-advanced-tab.browser.spec.ts`.
