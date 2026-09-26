# BUG_20260926_trace-colour-not-persisted

**Status:** RESOLVED

## Symptom

A project's trace colour, as set with the toolbar's "Color" button, is lost on reload. The
project comes back with the first free palette colour.

John, 2026-09-26: any setting that is not persisted into the OpenISD project file or the app
config file is a bug.

## Evidence

Checked 2026-09-26 on `main` at 540caec3:

- `packages/ui/src/logic/presentationState.ts`: `traceColors` is keyed by project uuid, in memory
  only. `cycleTraceColor()` (the toolbar's "Color" button, `OriginalShell-hooks.ts` `cycleColor`)
  writes it.
- `appState.ts` `currentViewSnapshot()` saves `ui` and `chart` (sweep range, Y ranges), not
  `traceColors`. On reload `assignTraceColor()` hands out the first palette entry not taken.

Audit of the other `presentationState` members, same date: `yRanges` and `sweepRange` are now
saved (9c07df36). `ui` (chart colours, chart tab, units) is saved whole. `newProjectOpen`,
`browseOpen`, `editDriver` and `editDriverInfo` are modal open flags, not settings.

## Cause

`traceColors` was never added to any persisted store.

## Fix

Ruling, John 2026-09-26: save it in the project.

Fixed 2026-09-26: the colour is `charts.traceColor` in the project file (`OpenISDProject.traceColor`;
`isModified()` ignores `charts`, so assigning one on open is not an unsaved change).
`presentationState.traceColors` is gone; `traceColor`/`assignTraceColor`/`cycleTraceColor` read
and write the project, and `assignTraceColor` keeps a saved colour.

## Verification

- `chart-view-persist.browser.spec.ts`: press "Color", reload, the button is still the new colour.
- `packages/design/test/domain/traceColor.test.ts`: the colour survives `.owpr` save and reload,
  and is not an unsaved change (red before the fix).
- `projectTraceColor.test.ts`: "Color" writes the project; a saved colour is kept on open.
