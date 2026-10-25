# BUG_20261017_auto-y-overlaps-first-frequency-label

**Status:** RESOLVED (Phone fixed by T545; Desktop fixed by T558, 21 Oct 2026)

## Symptom
The "Auto Y" box in the chart's bottom-left corner is drawn over the first frequency label (10).

## Cause
Auto Y was positioned absolutely at the chart bottom-left (`left: 2px; bottom: 1px`), overlapping the first frequency label centred on the plot's left edge (44 px).

## Fix
- Phone: Auto Y moved into the Tune and What-if sheet footer (T545).
- Desktop: Auto Y moved to the title row right after the Data button in `.gtitle` (T558, QO278 option b). The first frequency label (10) is clear and unobstructed.
- Verification: unit test `packages/design/test/chart/chart-layout.test.ts`, browser test `packages/ui/test/ui/original-chart-auto-y.browser.spec.ts` ("Auto Y sits in the title row and does not overlap the first frequency label"), visual regression baselines updated, before/after gallery verified by check-answerable.mjs at http://localhost:8000/winisd/ui-gallery/T558/index.html.
