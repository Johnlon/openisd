# ui's `ProjectMeta` is a second declaration of model's `OpenISDProjectMeta`

## Status
FIXED

## Symptom

Two field-identical interfaces declare the same concept — a project's metadata block:

- `packages/ui/src/types.ts:272` — `ProjectMeta { name; creator; created; modified; description }`
- `packages/model/src/openisdProject.ts:278` — `OpenISDProjectMeta { name; creator; created; modified; description }`

All five fields are `string` in both. The domain object already owns the concept
(`OpenISDProject.projectMeta()` / `setProjectMeta()` return and take `OpenISDProjectMeta`),
while the ui declares its own copy for `AppState.project`, `SerializedState.project`, and
`serialize()`'s parameter.

## Evidence

`grep -n "interface ProjectMeta" packages/ui/src/types.ts` → line 272;
`grep -n "interface OpenISDProjectMeta" packages/model/src/openisdProject.ts` → line 278.
Field lists compared side by side on 2026-08-23: identical names, identical types, identical
order. `managedProject.ts` converts between the two by structural assignment, which only
works because they are the same shape — the compiler enforces nothing across the pair, so a
field added to one silently desynchronises the other.

## Cause

`ProjectMeta` predates `OpenISDProjectMeta`; when the domain object gained its own meta
accessors (Lane P), the model declared its type rather than importing the ui's (correct —
model must not import ui), and the ui copy was never deleted. The result is the exact case
the one-model rule bans: two declarations of one concept, held equal only by luck.

## Fix

Delete `ProjectMeta` from `packages/ui/src/types.ts`. Every ui site
(`AppState.project`, `SerializedState.project`, `serialize()`, `appState.ts`,
`useDesignIO.ts` meta mirroring) imports `OpenISDProjectMeta` from `@openisd/model`.
No serialized byte changes: the field names are already identical.

## Verification

Fixed 2026-08-23 in the project-repo move: `ProjectMeta` deleted from ui/types.ts; every ui
site (`AppState.project`, the payload's `project` slot, `appState.ts`, `useDesignIO.ts`,
`OriginalShell.vue`, tests) now imports `OpenISDProjectMeta` from `@openisd/model`.
`grep -rn "\bProjectMeta\b" packages/ui/src packages/persistence/src` finds only
`OpenISDProjectMeta`; all three typechecks 0; persistence round-trip tests green with the
unchanged payload field names.
