# Editing Project name/creator/created/modified/description never reaches `ManagedProject` — Save persists stale meta

Status: FIXED. Found and fixed while wiring `OriginalShell.vue`'s tab UI onto the real project
registry (`PROMPT_RELEASE_HARDENING` plan, item 1): needing a genuine per-project source for
each open tab's display name surfaced that switching focus between two already-open projects
via `focusProject()` alone (no load call) left `state.project` showing the PREVIOUSLY focused
project's meta, which is a strictly worse, newly-reachable form of the same underlying defect
described below — so the fix could not be deferred.

## Symptom

Typing a new value into the Original skin's Project tab — Name, Creator, Created, Modified, or
Description (`OriginalShell.vue`, the `state.project.name`/`.creator`/`.created`/`.modified`/
`.description` `v-model` fields) — updates what the UI shows, but Save/Save As/Export/Share
persist the OLD values from whenever the project was last loaded or created, silently
discarding the edit.

## Evidence

- `packages/ui/src/logic/appState.ts`'s `state.project` is a plain, independent reactive
  object (`buildState()`), not an accessor onto the focused project — unlike `state.box`,
  which reads/writes the focused `ManagedProject`'s own `activeAlignment()` on every access.
- The only writers of `state.project` are `applyLoadedProject()`, `newProject()`, and
  `resetProjectToGround()`, each doing `Object.assign(state.project, project.projectMeta())` —
  a one-shot COPY taken at load time, never written back.
- `state.project.name`/`.creator`/`.created`/`.modified`/`.description` are bound directly by
  `v-model` in `OriginalShell.vue`'s Project tab (around `state.project.name` etc.) — every
  keystroke there writes ONLY into this disconnected copy.
- `currentProject()` (`appState.ts`) returns `requireFocusedProject().projectToPersist()`,
  which is `managedProject.ts`'s `#committed.project.copy()` — the domain object's OWN
  internal `OpenISDProject`, whose meta is set only via `OpenISDProject.setProjectMeta()`
  (`packages/model/src/openisdProject.ts:1003`).
- `grep -rn "setProjectMeta" packages/ui/src` returns zero hits — nothing in the UI package
  ever calls it. `ManagedProject` itself has no `setProjectMeta()`/`projectMeta()` passthrough
  at all (confirmed by reading `managedProject.ts` in full).
- `@openisd/persistence`'s `projectRepo.ts` only calls `setProjectMeta()` on the READ path
  (restoring a saved blob, `projectRepo.ts:258`) — never on save. Save
  (`projectRepo.ts:202`, `project: project.projectMeta()`) reads straight from the
  `OpenISDProject` it was handed (`currentProject()`'s result), which is the domain object's
  own stale meta, not `state.project`.

## Cause

`state.project` was built as a plain appState-level mirror, written once at each explicit
load, with no bidirectional sync back to `ManagedProject`'s own record — unlike every other
project field (box, vent, PR, driver), which is read AND written straight through to the
domain object. Project meta is the one exception that got a second, disconnected copy instead
of a passthrough accessor.

This predates the multi-project work — it exists identically for the single always-open
project today. It was not previously caught because renaming rarely happens right before a
Save/Export/Share in normal use, and the visible page state ("Project name: Foo") looks
correct even though nothing underneath agrees with it.

## Fix

`packages/ui/src/logic/appState.ts`'s `buildState()`: `state.project` is now
`buildProjectMetaAccessor()`, five `Object.defineProperty` accessors (one per meta field), each
reading `(focusedProject() ?? EMPTY_PROJECT_DEFAULTS).snapshot().projectMeta()[key]` and writing
via the FOCUSED project's own existing public `mutate()` escape hatch —
`p.mutate(proj => proj.setProjectMeta({ ...proj.projectMeta(), [key]: v }))` — reusing
`ManagedProject`'s already-public `mutate()`/`snapshot()` (no new methods needed:
`OpenISDProject.setProjectMeta()` was already public, just never called from the UI package).
`state.project = {...}` (whole-object assignment, used by `newProject()`/`resetProjectToGround`)
goes through a matching object-level setter.

`newProject()` reordered: `p.loadEmpty()` now runs BEFORE `state.project = {...}`, not after —
`loadEmpty()` replaces the whole design (`ManagedProject.load()`), which would otherwise wipe a
meta write made ahead of it now that `state.project` writes reach the domain object.
`applyLoadedProject()`'s `Object.assign(state.project, project.projectMeta())` was deleted —
`p.load(project)` already lands that same meta on the domain object, and `state.project` now
reads it straight through, so the assignment was redundant.

## Verification

- `npx vue-tsc --noEmit` on `packages/ui` — clean.
- `npx vitest run --root packages/ui --exclude '**/*.browser.spec.ts'` — 90 files / 2138 tests
  pass, including `test/logic/persist.test.ts`'s save/load round-trips and
  `test/ui/original-skin.browser.spec.ts`'s `'Original skin: Project Modified styling ...'`
  (switches focus between two open projects, asserts the meta-derived `is-unsaved` state
  survives the switch correctly per-project) and `'Revert/reset button resets modifications
  correctly'` (edits `state.project.name` then reverts it) — both exercise exactly the path
  this bug was about, and both pass.
- Manual trace: typing a new Name now calls the accessor's setter → `p.mutate(...)` →
  `OpenISDProject.setProjectMeta()` on `#committed.project` → `currentProject()`/
  `projectToPersist()` (what Save reads) reflects it immediately, no separate write-back step.
