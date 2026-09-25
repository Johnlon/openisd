# `ProjectWrite`/`ProjectRead` are two hand-maintained interfaces for one saved payload

## Status
FIXED

## Symptom

`packages/persistence/src/repos/projectRepo.ts` declared the open design's persisted payload
TWICE, as two independent interfaces:

```ts
export interface ProjectWrite {
  params: UiParams;
  box: BoxType;
  meta: OpenISDProjectMeta;
  view: ViewSnapshot;
  driverText: string | undefined;
}

export interface ProjectRead {
  params?: Partial<UiParams>;
  box: BoxType;
  meta?: OpenISDProjectMeta;
  view: ViewSnapshot;
  driverText?: string;
}
```

Same four data fields, hand-typed twice with different optionality on each — `params` required
on write, `Partial` and optional on read; `meta`/`driverText` required-vs-optional the same way.
Nothing enforced the two stayed in sync. Adding a field to one (as every previous feature that
touched a saved design's shape did) required remembering to add it to the other by hand, with no
compiler check that both were updated, and no test that would fail if they diverged — the exact
"read/write mismatch" risk John flagged on 2026-08-23.

## Evidence

`packages/persistence/src/repos/projectRepo.ts` (pre-fix, git history at
`8f1d7f1`): `ProjectWrite` at the old line ~74, `ProjectRead` at the old line ~84 — same file,
21 lines apart, both exported and both consumed across `packages/ui/src/logic/appState.ts`
(`currentProjectWrite()` / `applyState()`), `useApplicationIO.ts`, and `App.vue`.

## Cause

The read side was written as "whatever a caller might still usefully apply" (optional so a
restore could skip absent fields) instead of being derived from the write side. Once both
existed as separate declarations, every later field addition to the payload was a two-site
edit with no shared source of truth — classic two-shapes-for-one-concept drift risk (the
project's own one-model rule).

## Fix

Collapsed to a single `ProjectPayload` interface with each field's optionality declared once:
`params`/`box`/`meta`/`view` required (there are no old saves this build must tolerate missing
them — `ProjectSchema.upgrade()` repairs shape faults in already-written payloads, it does not
retroactively justify modelling a field as optional here); `driverText` optional for the one
real, current reason a field can be absent — a brand-new project before any driver has been
picked from the library (`managedProject.persistedDriverText()` returns `undefined` for exactly
that state). Every door on `ProjectRepo` (`saveLocal`/`loadLocal`/`stateToUrl`/`loadFromHash`/
`readProjectText`/`saveToFile`/`saveToNewFile`) now takes and returns this one type — a field
added to the payload is visible to every door by construction, not by remembering a second edit.

Landed together with the QO90 rework that also split the payload's CONTENT scope (pure project
vs. full session) — see `packages/persistence/src/repos/projectRepo.ts` and
`packages/persistence/src/repos/viewStateRepo.ts`.

## Verification

`packages/persistence/src/repos/projectRepo.ts` declares exactly one payload interface
(`ProjectPayload`); `grep -rn "ProjectWrite\|ProjectRead\b" packages/` (excluding this bug file)
finds nothing. `packages/persistence` and `packages/ui` both typecheck 0 errors
(`npx tsc --noEmit` / `npx vue-tsc --noEmit`). `packages/ui/test/logic/persist.test.ts`,
`boxActiveSync.test.ts` and `useApplicationIO.test.ts` — 21 tests — pass against the single type,
including a new test asserting the local-save wire carries no view fields even when the
`ProjectPayload` handed to `saveLocal` carries a real `view` (QO90).
