# BUG_20260927_pr-transfer-charts-missing

**Status:** OPEN

## Symptom
WinISD's passive-radiator box has two charts OpenISD lacks: "Transfer function magnitude (PR)" and
"Transfer function phase (PR)" (chart menu rows 10 and 11). Chart parity needs both (John, 2026-09-27:
"create it - charts parity !!").

## Evidence
Chart review checklist §0 marks both ✗. OpenISD's chart list (packages/ui/src/logic/series.ts
TAB_META) has no PR transfer chart; the sweep result (packages/design/engine/types.ts) has no PR
transfer value.

## Cause
Never built.

## Fix
Capture WinISD's plotted values (winisd_research runs/pr-w5-tf-1), identify the quantity from the PR
model (GHIDRA_FINDINGS "Passive radiator — `0x45a960`"), compute it in the engine sweep, show it as two
charts for the passive-radiator box only.

## Verification
Engine test against the captured values (≤ 1e-12); chart review §3.6 rows turn ✅.
