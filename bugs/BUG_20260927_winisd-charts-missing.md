# BUG_20260927_winisd-charts-missing

**Status:** OPEN

## Symptom
WinISD has four charts OpenISD lacks: "Transfer function magnitude (PR)" and "Transfer function
phase (PR)" (passive radiator, chart menu rows 10 and 11), "Rear port - Gain" (vented, row 14) and
"Front port - Gain" (bandpass 4th, row 16). Chart parity needs both (John, 2026-09-27:
"create it - charts parity !!").

## Evidence
Chart review checklist §0 marks all four ✗. OpenISD's chart list (packages/ui/src/logic/series.ts
TAB_META) has no PR transfer chart; the sweep result (packages/design/engine/types.ts) has no PR
transfer or port gain value.

## Cause
Never built.

## Fix
Capture WinISD's plotted values (winisd_research runs/pr-w5-tf-1, then a vented and a bandpass 4th
port-gain capture), identify each quantity from the box models in GHIDRA_FINDINGS, compute it in the
engine sweep, show each chart for its box type only.

Chart menu lists only the charts that apply to the box (John, 2026-09-27: "a nice improvement over
WinIsd is to only show the applicable charts in the drop-down - no pr excursion if no pr and no air
speed if no port"). WinISD lists every chart for every box. The per-box chart list is a decision, so
it lives in packages/design (one function of the box type, exhaustive over box types); both skins
read it and display only. Replaces today's "n/a" Air velocity chart on unported boxes
(packages/ui/src/logic/series.ts Port builder).

## Verification
Engine test against the captured values (≤ 1e-12); chart review rows turn ✅.
