# BUG_20260926_unreadable-session-overwritten-with-an-empty-one

**Status:** RESOLVED

## Symptom

A stored open-project session that failed to restore was replaced, during the same boot, with
an empty one. Every project that was open at the refresh was gone, permanently. The visible
consequence reported from https://openisd.app/ on 2026-09-25 was the fault dialog reading
`no project is focused`, raised after the projects had already been destroyed: the stored view
still said the Tune panel was open, that panel reads the focused project, and there was no
longer one.

John's storage at the time: `openisd_open_sessions: 31 bytes` — the exact length of
`{"entries":[],"focusedId":null}`, which is what the boot writes when nothing is open.

## Evidence

- `packages/persistence/src/repos/projectRepo.ts:263` `loadOpenProjects()` returns an error
  array as soon as one entry fails `readProjectText`, discarding the whole session.
- `packages/ui/src/ui/App.vue` `onMounted` logged that failure, carried on with no project,
  and then called `saveOpenProjects(openProjects(), focusedProject())` unconditionally.
- Probe (2026-09-26): booting with a session record whose entries are valid JSON but not
  loadable projects left `openisd_open_sessions` = `{"entries":[],"focusedId":null}`.
  `echo -n '{"entries":[],"focusedId":null}' | wc -c` → 31.
- `packages/ui/test/persistence/unreadable-session-is-not-destroyed.browser.spec.ts` failed on
  that exact value before the fix.

## Cause

Two facts about the same record: the boot could not read it, and the boot then saved over it.
Saving was armed at the end of `onMounted` regardless of whether the restore had succeeded, so
the empty state the failed boot ended in became the stored state.

## Fix

`App.vue` records that the session was unreadable and leaves the record untouched for that
boot — no final `saveOpenProjects`, and saving stays disarmed. It arms again, and writes, the
first time a project is open, so work done after the failed boot still persists.

The panels that made the failure visible are gated too
(`BUG_20260926_restored-panels-mount-without-a-project`): `App.vue` will not mount the Tune
panel or the Driver Editor without a focused project, and the restore watchers in
`OriginalShell-hooks.ts` only reopen one when a project is focused.

## Verification

`packages/ui/test/persistence/unreadable-session-is-not-destroyed.browser.spec.ts` — the
unreadable record is byte-identical after the boot, and is replaced once a project is opened.
`packages/ui/test/ui/restored-panels-need-a-project.browser.spec.ts` — neither panel reopens
with no project.

## Still open

One unreadable entry still discards the good ones: `loadOpenProjects()` returns on the first
failure instead of restoring what it can and reporting the rest. The record is no longer
destroyed, so this costs a session rather than the projects — recorded separately as
`BUG_20260926_one-bad-session-entry-discards-the-readable-ones`.
