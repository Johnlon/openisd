# BUG_20261001_options-chart-y-limit-partial-edit-silently-drops

**Status:** OPEN

## Symptom

In the Options dialog → Plot Window → Limits table, editing **only one** of a chart row's
Start/End (leaving the other showing its placeholder default) saves an override that every
chart **silently ignores** — the chart keeps auto-scaling and nothing says why. The same
silent drop happens for a saved Start ≥ End pair. The placeholder values shown in the
untouched fields (e.g. SPL Start `40`) are never actually applied; they are display-only.

## Steps to reproduce

1. Launch the app, open any project with charts.
2. Open Options (wrench toolbar icon) → Plot Window tab → Limits table.
3. On the **SPL** row, set **End** to `100`. Leave **Start** showing its placeholder `40`.
4. Click OK.
5. Open the SPL chart: it still auto-scales — the `100` end limit is nowhere.
   Expected: the Y axis stops at 100 (with Start honoured at its shown default `40`, or the
   dialog demanding both halves — either way, not silence).

Non-browser repro from the code path: `setLimit('SPL','max')` with an untouched Start writes
`{min: NaN, max: 100}` into `presentationState.yRanges`.

## Evidence

Re-verified 2026-10-01 by reading the current source:

- `packages/ui/src/ui/components/OptionsModal.vue:151-154` — `setLimit` seeds the untouched
  half with `NaN` (`const cur = draft.yRanges[chartId] ?? { min: NaN, max: NaN }`), and
  `parseFloat(inputValue(e))` yields `NaN` for a cleared field (`domEvents.ts:34` returns
  the raw string; `parseFloat('') === NaN`).
- `packages/ui/src/ui/components/GraphPanel.vue:42-44` — `viewPlot` applies the override
  only `if (ov && isFinite(ov.min) && isFinite(ov.max) && ov.min < ov.max ...)`; one `NaN`
  half or an inverted pair ⇒ the whole override is dropped. No warning is raised anywhere.
- Aggravation: `packages/ui/src/logic/appState.ts:705-706` persists yRanges as-is, and
  `JSON.stringify(NaN)` → `null`, so the broken half survives save/reload too.

## Cause

The Options dialog stores each row as an independent half, but the chart's override contract
is "both halves finite and ordered, or ignore entirely". The dialog's placeholder defaults
(`row.start`/`row.end` in `LIMIT_ROWS`, OptionsModal-hooks.ts) are display-only and never
written, so a one-sided edit can never satisfy the chart's contract.

## Fix

Pick one, at the dialog boundary (`setLimit` / `saveAndClose` in OptionsModal.vue):

1. On commit, fill an untouched half from the row's placeholder default (`row.start` /
   `row.end`) so a one-sided edit produces a complete, ordered override; or
2. Treat a row as "not set" unless BOTH halves are finite and `min < max`, and surface
   that in the dialog (e.g. mark the row invalid), so silence is impossible.

Option 1 matches the placeholder's implied promise; either removes the silent drop.

## Verification

- New unit test in `packages/ui/test/hooks/OptionsModal-hooks.test.ts`: edit only End for a
  row, `apply()`, assert `presentationState.yRanges[tab]` is a complete finite ordered pair
  (option 1) or absent (option 2).
- Browser check in the settings-vented-band spec's style: set SPL End 100 → OK → SPL chart
  Y max is 100.
