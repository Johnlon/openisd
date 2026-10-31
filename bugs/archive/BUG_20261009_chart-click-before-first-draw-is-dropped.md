# BUG_20261009_chart-click-before-first-draw-is-dropped

**Status:** CLOSED (John, 16 Oct 2026): not a user bug, the first-draw window is milliseconds; specs wait for the first draw.

There are two things, the chart's first draw and the chart's click handler. `redraw()` sets `geoRef`
on the first draw; `onPointerDown` (`packages/ui/src/ui/components/GraphPanel.vue:106`) returns
silently when `geoRef` is unset. A click that lands before the first draw is lost: the cursor does
not lock and nothing tells the user. It showed up as a load-sensitive spec failure (F1).

We need: a click before the first draw is not lost (it is applied once the chart has drawn, or the
chart is not clickable until drawn and says so). Test first.
