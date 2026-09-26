# BUG_20260926_sweep-range-and-y-ranges-not-persisted

**Status:** OPEN

## Symptom

The swept frequency range (fmin/fmax) and each chart's Y-axis range are not saved anywhere.
They're not in the project file and not in the app settings. Restart the app, or reproduce a
chart from saved files, and they're back at the defaults (10 Hz – 20 kHz, auto Y). A chart can't
be reproduced from the saved state alone.

John, 2026-09-26: any setting that is not persisted into the OpenISD project file or the app
config file is a bug.

## Evidence

Checked 2026-09-26 on `main` at 2d32b63c:

- `packages/ui/src/logic/presentationState.ts:71`: `sweepRange` lives only in the in-memory
  presentation state, default `{min: 10, max: 20000}` (line 87). `yRanges` (line 66) is the same.
- `packages/ui/src/logic/appState.ts:698`: `currentViewSnapshot()`, the only thing the
  view-state autosave writes, returns `{ ui: presentationState.ui }`. `sweepRange` and
  `yRanges` are not in it.
- `sweepRange` is a sweep input, not only a view crop:
  - `appState.ts:466` builds the grid passed to `p.sweep(grid)` from it.
  - `OriginalShell-hooks.ts:868` does the same for `p.sweep` / `p.maxCurves`.
- The comment at `presentationState.ts:67-70` says "View-only … triggers no re-sweep". The two
  call sites above contradict it.

## Cause

On 2026-09-24 `sweepRange` moved from the project (`sweepFmin_hz` / `sweepFmax_hz`) to
app-global presentation state, per John's ruling that zoom is global rather than per project.
The move never added it to any persisted store, and `yRanges` never had one.

## Fix

Store both in the app-level settings: global, per the 2026-09-24 ruling, not per project.
Load them at startup. Correct the "view-only" comment.

Before fixing, audit every other `presentationState` member and every sweep input for the same
gap.

## Verification

A browser test that sets a sweep range and a Y range, reloads the page, and finds both restored.
A unit test on the settings repo round-tripping both fields.
