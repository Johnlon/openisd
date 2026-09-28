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

## Fix
Undecided: what WinISD displays as the PR box tuning for Npr > 1 is not yet captured
(⚠ unverified). Capture it, then match it by default.

## Verification
Fixture from a WinISD capture of the displayed tuning at Npr = 2; domain test at ≤1e-12.
