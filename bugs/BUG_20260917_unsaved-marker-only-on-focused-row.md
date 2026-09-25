# BUG_20260917_unsaved-marker-only-on-focused-row — yellow unsaved-changes bar driven by focus, not by dirtiness

**Status:** OPEN

Human ruling 2026-09-17 (verbatim): "there is a yello side bar on th eproject list that is
meant to indicate unsave dchanges but it only show up when the project row has focus - this
is a bug".

## Symptom

The yellow/orange side bar on a project row (the `is-unsaved` highlight) is meant to mark
projects with unsaved changes, but it only ever appears on the FOCUSED row — and only while
that row is the project being viewed. A non-focused project that has unsaved changes never
shows the marker, so there is no way to see at a glance which projects are dirty.

## Evidence

- `packages/ui/src/ui/shells/original/OriginalShell.vue:155` (re-read this session):
  `:class="{ selected: p === focused, 'trace-hidden': !isRowVisible(p), 'is-unsaved': p === focused && isModified }"`
  — the `is-unsaved` class requires `p === focused`, i.e. focus, not per-row dirtiness.
- `packages/ui/src/ui/shells/original/OriginalShell.vue:908-910`: the `.is-unsaved` styles
  (yellow background `#fff3b3`, orange left border `#f2994a`) — this is the yellow bar.
- `packages/ui/src/logic/appState.ts:479-482`: `isModified` is a single global computed that
  reads only the FOCUSED project (`live.value?.isModified()`), so no per-project dirty flag
  exists for the template to consult.

## Cause

The row class binds a global focus-scoped boolean (`isModified`, which tracks only the
focused project) instead of each row's own project dirty state. There is currently no
per-project `isModified()` read in the template at all.

## Fix

Bind `'is-unsaved'` to the row's own project state (`p.isModified()`), dropping the
`p === focused` condition. If `OpenISDProject.isModified()` is not reactive per instance,
expose a per-project reactive dirty computed (e.g. a map keyed by project) in
`OriginalShell-hooks.ts` so the template reads per-row dirtiness reactively.

## Verification

1. Unit/hook test: with two open projects, edit the non-focused one — its row must show
   `is-unsaved`; save it — the marker clears; the focused clean project never shows it.
2. Browser check (extends `original-projects.browser.spec.ts`): edit project A, select
   project B — A's row keeps the yellow bar while B is focused.
