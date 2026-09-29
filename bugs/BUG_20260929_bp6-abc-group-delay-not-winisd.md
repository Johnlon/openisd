# BUG_20260929_bp6-abc-group-delay-not-winisd

**Status:** OPEN

## Symptom
OpenISD's group delay for 6th-order bandpass and ABC boxes differs from WinISD's, while their
transfer function phase matches to 8e-12°. ABC is off by 7.1 ms at 1 Hz; BP6 by 0.11 ms at 4 kHz.

## Evidence
winisd_research runs/bp6-w5-base2 and abc-w5-base2 (2026-09-29) against OpenISD on WinISD's grid:

| Box | 1 Hz WinISD / OpenISD (ms) | 528 Hz WinISD / OpenISD (ms) | 12 kHz WinISD / OpenISD (ms) |
|-----|---------------------------:|-----------------------------:|-----------------------------:|
| BP6 | −38.4988 / −38.4987        | 0.0569 / 0.0407              | −0.0268 / 0.0005             |
| ABC | −40.988 / −33.888          | 0.00446 / 0.0559             | 1.5e-5 / 1.1e-4              |

Sealed/vented/BP4/PR group delay matches to ~7e-4 ms (the 1e-10 Hz step staircase,
GHIDRA_FINDINGS.md "Group delay").

## Cause
⚠ unverified: WinISD's group delay differentiates the phase of an H from its per-box chart
routine; for BP6 (`0x5668c0`) and ABC that H is not the one behind their plotted TF phase. Not
decoded yet.

## Findings (2026-09-29)
- **BP6**: WinISD's group delay equals −dφ/dω of its own plotted TF phase (grid difference)
  up to ~200 Hz (1 Hz: −38.4538 vs −38.4538 ms). Above that WinISD's value is noise of up to
  ±0.03 ms (1.2 kHz: WinISD −0.0254, phase slope +0.0178), 100× WinISD's 1.8e-4 ms rounding
  staircase. ⚠ unverified: precision loss in WinISD's own BP6 H at f ± 1e-10 Hz; matching it
  needs WinISD's exact operation order.
- **ABC**: WinISD's group delay is not the slope of its plotted phase, even at 1 Hz (WinISD −40.958,
  phase slope −33.858 ms). So it differentiates a different H. Scratch fit
  (scratchpad `gdfit.ts`, engine `solve()` with the project's exact solver params, U0 reproduces
  OpenISD's gd exactly):

  | H                      | 1 Hz      | 1.6 Hz    | 10.75 Hz | 115.6 Hz | 1242 Hz  |
  |------------------------|-----------|-----------|----------|----------|----------|
  | WinISD                 | −40.9585  | −36.5939  | −3.3130  | 1.4576   | 0.000795 |
  | jω·U0 (OpenISD today)  | −33.8584  | −29.4956  | 3.6221   | 2.3872   | 0.010059 |
  | U0/UD                  | −40.9600  | −36.5976  | −3.4805  | 1.7782   | 0.000760 |

  U0/UD (box-only, driver removed) is close at both ends but not exact mid-band. Not matched
  either: ±1 sums of UD/UP/UPr/UPi/U0, other box types' H, Ricl → 0 or ∞, lossless.

## Fix
Decode chart 12 of the ABC routine `0x4591b0` under the wine debugger (breakpoint on its arg calls at f ± δ, log H), then compute group delay from the same H. BP6: same decode to find the lossy operation order.

## Verification
Fixture from both runs; engine test within the step staircase (≤ 1e-3 ms).
