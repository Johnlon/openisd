# BUG_20260928_pr-system-tuning-ignores-radiator-count

**Status:** OPEN

## Symptom
A passive radiator box's displayed system tuning (`passiveRadiator.systemTuning_hz`) is the same
whether the box has one radiator or several.

## Evidence
W5-1138SMF in 10 L, radiator with 10 g added mass, two radiators: OpenISD shows 34.28 Hz. The
physical tuning 1/√((Map/Npr)·(Cab ∥ Npr·Cap))/2π is 39.45 Hz. WinISD's own loss frequency for the
same box is 19.73 Hz (winisd_research runs/pr-w5-me-npr-1, GHIDRA_FINDINGS.md "Added mass and
radiator count").

## Cause
The domain's tuning relation uses one radiator's mass and compliance and never reads `count`.

## WinISD's displayed tuning (captured 2026-09-28)
winisd_research `toys/probe_pr_tuning_edit.py`, run pr-w5-1 (`runs/pr-w5-1/pr_tuning_edit.json`):
the Box pane Fb reads the file's stored Fr on load (36.50), stays 36.50 after typing the radiator
count 2, and reads **39.45** after then typing Me 0.01 — the physical tuning above, count included.
Typing the count alone does not refresh the field (a WinISD staleness quirk, not a calculation).

## Fix
Tuning relation (engine/pr/PrEngine.ts `tuning`, `massForFp`, and the handle solve) uses
Map/Npr and Npr·Cap. Target: 39.45 Hz for the case above.

## Verification
Fixture from a WinISD capture of the displayed tuning at Npr = 2; domain test at ≤1e-12.
