# Open project list is lost on page refresh

Status: OPEN

## Symptom

Reloading the app (F5 / browser refresh) discards every open project. The user is
returned to the empty no-project state and any unsaved work in every tab is gone.

## Cause

The open-project registry is in-memory only. `packages/ui/src/logic/appState.ts` holds
`projects: ShallowRef<OpenISDProject[]>` and `focusedIndex: Ref<number>` as HMR-surviving
module singletons (`getOrInit(slots, 'projects', () => shallowRef([]))`). They survive a
hot-module reload but not a full document load — nothing serialises them to `localStorage`
and nothing rehydrates them at startup.

`appState.ts`'s own header states this is by design: "the app's live reactive truth — Vue's
sense of 'store'. Not persistence." The persistence half was never built for the
multi-project list. A single project's view state (cursor, unit tokens, panel layout,
open-panel flags) IS persisted via the view-state autosave (QO90) under `presentationState.ui`,
and `packages/persistence`'s `projectRepo` can already serialise one `OpenISDProject` to
`.owpr` JSON — but neither is wired to `projects[]` / `focusedIndex`.

## Impact

Any refresh — deliberate or accidental (browser crash, OS update, mis-click) — loses all
open projects and their unsaved edits. A user who has not hit Save on every tab loses that
work with no warning and no recovery.

## Fix

Not yet decided. User asked (2026-09-08) for a **full session store**: persist the open
project list, the focused index, and each project's per-project view state as one session
snapshot, rehydrated on startup. Scope spans `appState.ts` (the registry + a save/restore
hook driven off `changeTicks`), `packages/persistence` (a multi-project session
serialise/deserialise, reusing `projectRepo`'s single-project JSON path), and
`presentationState` / the view-state autosave (per-project view state keyed by project).

Sequencing (2026-09-08): land the `packages/model` → `packages/design` migration as the
green commit FIRST, then build the session store as its own TDD feature on a clean base.

## Verification

None yet. When built: a browser test that opens two projects, edits one, reloads the page,
and asserts both tabs and the edit are still present and the same tab is focused.
