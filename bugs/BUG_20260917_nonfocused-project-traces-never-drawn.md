# BUG_20260917_nonfocused-project-traces-never-drawn — only the focused project is ever swept/drawn

**Status:** OPEN

Human ruling 2026-09-17 (verbatim): "yes multiple traces should be shown simultanwiudsly for all selected projiect" — the multi-trace behaviour is REQUIRED, not deferred. This bug also blocks the skipped test `original-projects.browser.spec.ts:43` ("hiding a project removes its trace…", skipped with a SKIP note citing this gap).

## Symptom

In the Original shell, every project row has a show/hide checkbox titled "Show/hide this
project's trace on the graph", and the "+ Copy" button promises its curves will be "overlaid
on the graph for comparison". None of that happens: only the FOCUSED project is ever swept
and drawn. The other rows' checkboxes and the trace-hidden strikethrough operate on a list
that is never plotted, so toggling them changes nothing on the canvas.

## Evidence

- `packages/ui/src/hooks/OriginalShell-hooks.ts:626-627` (re-read this session):
  the comment states "Compare-overlay curves for OTHER open projects are NOT computed in
  this pass: the app's one sweep pipeline only ever sweeps the FOCUSED project
  (BUG_20260823_compare_overlays...)" and the code is literally
  `const overlays = computed<Design[]>(() => []);` — hard-coded empty.
- `packages/ui/src/ui/shells/original/OriginalShell.vue:154-160`: each `project-row` renders
  the checkbox wired to `isRowVisible(p)` / `setRowVisible(p, …)`, and line 158 titles it
  "Show/hide this project's trace on the graph".
- `packages/ui/test/persistence/original-projects.browser.spec.ts:43` — the browser test
  asserting the promised behaviour fails because the canvas colour count never changes
  (AGY session evidence, task-1207/task-1218: 57 colours before and after hide).
- Predecessor bug `bugs/BUG_20260823_compare_overlays_pass_persisted_driver_text_where_an_engine_driver_object_is_required.md`
  (Status: OPEN) describes an EARLIER shape of this gap, where `overlays` was built from
  `ProjectRow.driver` values that were persisted TEXT rather than `EngineDriver` objects.
  That construction has since been removed entirely — the current code plots nothing.
  The predecessor's mechanism section is stale; this file is the current record.

## Cause

`buildPlotData` (OriginalShell-hooks.ts:580) receives `overlays.value` as its overlay
`Design[]`, and `overlays` is hard-coded to `[]`, so no non-focused project ever contributes
curves. The one sweep pipeline only sweeps the focused project.

## Fix

Give the sweep/plot pipeline real overlay data: compute a `Design` per non-focused open
project (respecting each row's `isRowVisible` flag) and pass that list to `buildPlotData` in
place of the hard-coded `[]`. Resolve whatever the predecessor bug documents about mapping a
project's persisted driver text to the `EngineDriver` object the curve builders need.

## Verification

1. Un-skip `original-projects.browser.spec.ts:43` ("hiding a project removes its trace from
   the chart, and showing it brings it back") — it must pass with no edits.
2. The "open projects are never written into the active design" test (line 62) must still
   pass: overlay drawing must not leak project data into the persisted active design.
3. Manual: open two projects, check both rows' checkboxes → both traces visible on the
   canvas; uncheck one → its trace disappears, the other stays.
