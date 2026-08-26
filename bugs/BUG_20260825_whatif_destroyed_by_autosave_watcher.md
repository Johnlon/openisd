# BUG_20260825 — an open what-if is cancelled by the autosave watcher on the very next tick

Status: OPEN — not yet fixed. Found while investigating persistence timing for a `packages/design` architecture discussion.

## Symptom

`packages/ui/test/ui/original-skin.browser.spec.ts:698` (`R1: an open Tune with uncommitted
what-if values is preserved across a reload`) fails. Confirmed by running it.

## Cause

`App.vue`'s autosave `watch(..., { deep: true })` re-runs on EVERY `ManagedProject.subscribe()`
notification, including edits made inside an open what-if. Its getter calls `currentProject()`
(`appState.ts`), which is `managedProject.projectToPersist()` — and `projectToPersist()`
unconditionally calls `#endWhatIfIfActive()` first (`managedProject.ts:764-767`), by design, so
only committed state is ever written to `localStorage`.

That's correct for what gets WRITTEN — but the same call also ENDS the what-if as a side effect,
because it's invoked on every reactive tick, not only when a save actually needs to happen. So
an open what-if is silently cancelled on the very next tick after any what-if edit, well before
the user does anything to end it themselves.

## Why it matters

`STATE_MODEL.md`'s stated rule — committed state persists, an open what-if survives a reload as
a UI-open flag with its values never written — does not currently hold. The what-if is destroyed
long before reload even matters.

## Scope of the fix

Not yet executed. The autosave watcher needs a read path that does NOT end an active what-if —
e.g. a `committedSnapshot()`-style accessor on `ManagedProject` that reads committed state
without touching `#overlay`, separate from `projectToPersist()`'s save-time behavior.

## Evidence

- `packages/ui/src/ui/App.vue:36-44` — the `watch()` block.
- `packages/ui/src/logic/appState.ts` — `currentProject()`.
- `packages/ui/src/logic/managedProject.ts:764-767` — `projectToPersist()` / `#endWhatIfIfActive()`.
- `packages/ui/test/ui/original-skin.browser.spec.ts:698` — the failing test.
