# BUG_20260926_restored-panels-mount-without-a-project

**Status:** RESOLVED

## Symptom

Reloading with no project open, after a session in which the Tune panel or the Driver Editor
had been open, raised the fault dialog with `no project is focused`. The app was left showing
a broken panel over the empty shell.

## Evidence

- Probe (2026-09-26): boot with `openisd_view` = `{"ui":{"originalTuneOpen":true}}` and no
  project → `NoFocusedProjectError: no project is focused` at `requireFocusedProject`, through
  `App.vue`'s gate computed, from `OgTune.vue` `fieldClasses`. With `originalEditorOpen` the
  same error arrives through `DriverEditorModal.vue` → `seedDraft`.
- `packages/ui/test/ui/restored-panels-need-a-project.browser.spec.ts` failed on both before
  the fix.

## Cause

The stored view remembers that a panel was open; the project it was open on is not restored
with it. The restore watchers in `OriginalShell-hooks.ts` set `presentationState.editDriver` /
reopened the editor from those flags without checking for a project, and `App.vue` mounted both
overlays outside its own project gate.

This is the visible half of
`BUG_20260926_unreadable-session-overwritten-with-an-empty-one` — that bug is why there was no
project to find.

## Fix

`App.vue` mounts neither overlay without a focused project. The two restore watchers only
reopen a panel when one is focused.

## Verification

`packages/ui/test/ui/restored-panels-need-a-project.browser.spec.ts`, both tests.
