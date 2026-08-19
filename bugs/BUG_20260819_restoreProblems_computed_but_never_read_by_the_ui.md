# `restoreProblems` is written by store.ts but read by nothing — a restore failure is silently dropped

# Status
OPEN

## Symptom

`packages/ui/src/logic/store.ts:626` — `export const restoreProblems = ref<string[]>([]);` — is
written at `store.ts:639`/`643` inside `applyState()` when a saved driver fails to load
(`restoreProblems.value = problems.map(p => 'saved driver was not loaded: ' + p)`), and the
comment at `store.ts:637` states its purpose plainly: "`restoreProblems` carries the reason to
the UI." Grepping every file outside `store.ts` for `restoreProblems` finds zero readers — no
`.vue` component, no other `logic/` module imports or displays it.

## Cause

Not investigated further — the export exists and is written, but the UI-side consumer that was
meant to read and display it was never built (or was removed and this was left behind). Either
way, a user whose saved/shared design fails to restore a driver currently gets no visible
explanation; the reason is computed and then goes nowhere.

## Fix

Not applied — reported per bug-first rule. Two legitimate directions, need triage rather than a
guess: (a) wire a UI element (e.g. the diagnostics/fault surface `DiagnosticsModal.vue` already
provides) to read and display `restoreProblems.value`, or (b) if the load-failure UX was already
	replaced by another mechanism, confirm that and delete this dead write instead.

## Verification

Not yet — no fix applied.
