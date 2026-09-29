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

## Fix
Decode chart 12 in the BP6 and ABC routines, then compute group delay from the same H.

## Verification
Fixture from both runs; engine test within the step staircase (≤ 1e-3 ms).
