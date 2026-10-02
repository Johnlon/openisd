# BUG_20261001_resize-observer-loop-fault-on-chart-grid

**Status:** RESOLVED

## Symptom
The diagnostics panel on openisd.app shows a fault: `ResizeObserver loop completed with
undelivered notifications` (John, Chrome on Windows, 2026-09-30 23:53 UTC).

## Evidence
`packages/ui/src/hooks/chartStack.ts:20`: the ResizeObserver callback writes `width`/`height`
synchronously; `style` derives the grid's height from that container height and is applied to the
same container, so the observer's own write resizes what it observes in the same frame.
`packages/ui/src/ui/components/GraphPanel.vue:331`: the canvas observer calls `redraw`
synchronously, and drawing resizes the canvas backing store. Chrome reports either as this error
event; the app's fault log records every error event.

## Cause
A ResizeObserver callback that changes layout inside the same frame. The browser breaks the loop
and raises the error event. No wrong output, but it lands in the fault log the user is asked to
send.

## Fix
Both observers defer their work to the next animation frame and `useChartStack` writes only when
the size actually changed.

## Verification
`packages/ui/test/hooks/chartStack.test.ts`: the observer callback does not change the style until
the animation frame runs, and an unchanged size schedules nothing. Fault log clean on openisd.app
after deploy.
