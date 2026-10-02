# BUG_20261001_spinning-a-filter-redraws-charts-only-on-release

**Status:** RESOLVED

## Symptom
Holding a filter spinner (e.g. LP Cutoff) with other projects open: the value spins but the charts
redraw only on release (John, 2026-10-01).

## Evidence
- `filters-tab.browser.spec.ts` "a held LP Cutoff spinner moves the swept SPL before release":
  the focused project's swept SPL changes on every `input` step (headless, one project) — the data
  moves; the paint does not get a frame.
- `OriginalShell-hooks.ts` `overlays`: a computed over `projectChanged` that called `p.sweep()` and
  `p.maxCurves()` for every other open project, on the main thread, on every focused-project edit.

## Cause
Every spinner step of the focused project re-swept every other open project on the main thread.
The next step arrived before the page could paint, so the charts showed only the final value.

## Fix
Only the focused project is swept per step (in the sweep worker). `SweepCache`
(`packages/ui/src/logic/sweepCache.ts`) holds each overlay project's last sweep and re-runs it only
when that project's own sweep job changes.

## Verification
`sweepCache.test.ts`: an unchanged project is not swept again; a project or grid change sweeps
again; projects cache separately; a blocked project gives null. Chart browser specs pass
(`original-skin`, `filters-tab`, `chart-view-persist`).
