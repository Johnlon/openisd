# BUG_20261017_chart-title-overlaps-top-level-label

**Status:** FIXED (T311)

## Symptom
17 Oct 2026, from fable's screenshot of the phone Graph tab: the chart title "SPL response" is drawn over
the top level label (100). The same happens on every chart, on all six phone sizes and on desktop.

## Cause
The canvas started the plot 18 px down (`canvas.ts`, a hand-typed margin). The title box (`.gtitle`: 5 px
from the top, 11 px text on a normal line height) ends 21.5 px down, so the top level label, drawn about 7 px
above the plot edge, sat inside the title.

## Fix
- `ChartLayout` (packages/design/chart/layout.ts) holds the plot margins, the title's bottom and the
  tick-label metrics. The canvas draws from it. The plot now starts 24 px down.
- The title is one 12 px line, 4 px from the top, and never wraps (style.css), so it ends 16 px down. The top
  level label reaches no higher than 17 px.
- Tests:
  - `packages/design/test/chart/chart-layout.test.ts`: the top label starts below the title, with a gap.
  - `packages/ui/test/ui/chart-title-clears-axis-labels.browser.spec.ts`: the title's real box ends above
    the top label on all six phone sizes, on every chart on the narrowest phone, and on desktop.

Before and after: [visual-pages/chart-title](http://lap:8000/winisd/visual-pages/chart-title/index.html).
