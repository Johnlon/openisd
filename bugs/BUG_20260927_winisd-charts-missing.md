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
speed if no port" … "etc"). General rule (John, 2026-09-27): a chart is listed where it logically applies to a
component the project has: port charts when the box has that port, PR charts when it has a radiator,
EQ/Filter charts always (the filter chain is always part of the project). Never "when the data
exists": missing data is a bug to fix, not a reason to hide a chart.
WinISD lists every chart for every box. The chart list is a decision, so it lives in packages/design
(one function of the project, exhaustive over box types); both skins
read it and display only. Replaces today's "n/a" Air velocity chart on unported boxes
(packages/ui/src/logic/series.ts Port builder).

## Verification
Engine test against the captured values (≤ 1e-12); chart review rows turn ✅.

## Progress (2026-09-27)
Done: PR transfer function magnitude/phase (passive-radiator box, `sweep.ts` `prTfMag`/
`prTfPhase`, null for every other box type) — matched to WinISD's own plotted values
(winisd_research runs/pr-w5-tf-1/-2) to 2.8e-14 dB / 4.5e-13°, well inside the ≤1e-12 tier;
WinISD's own phase-chart wart reproduced exactly (both PR charts come off Z = K·ω·Upr with ω
taken as a real scalar, so |Z| matches the magnitude chart's |jω·Upr| but arg(Z) = arg(Upr) —
WinISD's phase chart omits the j rather than dropping a rotation). Cone excursion (PR) moved
out of the Excursion chart into its own `PRExcursion` id.

The chart menu (`ChartId`/`Engine.chartsFor`, `packages/design/engine/charts.ts`) now lists
only the charts that apply to the project's box, in WinISD's own row order; both skins read
it. `Port` split into two design-owned ids, `RearPort` (vented) and `FrontPort` (bandpass4) —
which port is itself a design decision, not a UI ternary. Chart review checklist rows for
both PR transfer charts turn ✅.

Pending: "Rear port - Gain" (vented) and "Front port - Gain" (bandpass 4th) — not in this
task. A vented port-gain capture (`winisd_research/runs/vented-gain-1`) already exists from
another session's work on that half.
