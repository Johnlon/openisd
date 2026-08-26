# Multi-project registry (`focusedProject()`) is decorative — no write path, no reactivity bridge, nothing in the app actually uses it

Status: OPEN — found while scoping a peer-session-relayed request to migrate off the
`managedProject` singleton onto `focusedProject()`. The migration agent refused to guess and
surfaced this; confirmed directly against the real code below.

## Symptom

`packages/ui/src/logic/appState.ts` (`projects`/`focusedIndex`/`openProjects()`/
`focusProject()`/`focusedProject()`, lines 74-100) is documented as "the ONE place which
projects are open, which is focused lives," replacing an ad-hoc `workspace.ts`/
`OriginalShell.vue` implementation. It has unit test coverage
(`projectListOrdering.test.ts`, `projectRegistry.test.ts`) that passes.

Despite this, opening a second project and calling `focusProject(1)` would not make a single
field edit, chart, or tab in the running app respond to project 1 in any way. The UI would
keep reading and writing project 0 exclusively, regardless of what the registry says is
focused.

## Evidence

- `focusedProject()` has ZERO call sites in production code anywhere under `packages/ui/src`
  — every reference outside `appState.ts`'s own definition is in the two registry test files.
  Confirmed via `grep -rln "focusedProject()" packages/ui/src --include='*.ts' --include='*.vue'
  | grep -v appState.ts` → no results.
- Every one of the 17+ files that read/write project state (`GraphPanel.vue`,
  `PRDefineModal.vue`, `OgFilters.vue`, `liveProject.ts`, `DriverEditorModal.vue`,
  `PREditModal.vue`, `useDesignIO.ts`, `driverSelection.ts`, `AdvancedOptions.vue`,
  `OgTune.vue`, `useVentGroup.ts`, `presentationState.ts`, `usePrGroup.ts`,
  `OriginalShell.vue`, `OptionsModal.vue`, `App.vue`, and more) imports and calls methods on
  the fixed `managedProject` singleton (`appState.ts:64`) directly, by name — never through
  `focusedProject()`.
- `focusProject(index)` (`appState.ts:98-100`) only writes a number into a `ref`:
  ```ts
  export function focusProject(index: number): void {
    if (index < 0 || index >= projects.value.length) return;
    focusedIndex.value = index;
  }
  ```
  Nothing reads `focusedIndex` to decide which object a write call should target.
- The one Vue reactivity bridge (`appState.ts:72`, `createLiveRef(managedProject)`) is
  constructed exactly once, at module load, permanently wired to the single `managedProject`
  instance (`liveProject.ts:createLiveRef`). It never re-subscribes. Even if a write call did
  go through `focusedProject()`, no chart or tab reading `live.value` would notice a change on
  a different project's instance.
- `OriginalShell.vue` (lines 390-587) has its own separate, parallel project-tab
  implementation (`openProjects = ref<ProjectRow[]>([])`, `activeProjectId`, `activeProject`
  computed, its own add/close/switch logic) that never touches `appState.ts`'s registry at
  all. So in the running app, `removeProject()` is never called and `focusedIndex` never
  moves — the registry is inert, not merely disconnected from writes.

## Cause

The registry (`appState.ts:74-122`, committed 2026-08-18 as `c2d5f9e0`, then in `store.ts`)
was added additively, seeded with the one existing project (`projects[0]` = `managedProject`),
with its own doc comment explicitly stating: "Rewiring `OriginalShell.vue`'s own multi-project
UI onto this registry... is separate, larger follow-on work (REVIEW.md Phase 1.4/1.5) — not
done in this pass; flagged, not silently deferred."

That flag undersells what's missing. It reads as "the registry works, the UI just doesn't use
it yet" — but the registry provides no actual mechanism for a second project to do anything:
no write path exists that could be wired to it without first rewriting ~150 lines of
`appState.ts`'s per-field dispatch functions, its sweep scheduler, and its vent/PR-group
watchers (all hardcoded to `managedProject` by name), and the `live` reactivity bridge would
need to become re-subscribable on focus change, which nothing in its current design supports
(`createLiveRef` takes one fixed target at construction, per `liveProject.ts`'s own docstring:
"`.live` always returns the SAME subscribable object").

## Fix

Not fixed — this is a scoping/design decision, not a small patch. Two real options:

1. **Build it for real** (the deferred Phase 1.4/1.5 work): wire `OriginalShell.vue`'s tab UI
   onto this registry, rewrite every `managedProject.X(...)` call site in the ~17 files to
   `focusedProject()!.X(...)` behind one top-level null gate, and make the reactivity bridge
   re-subscribe to whichever project is focused on every focus change.
2. **Remove the registry**, since it is currently pure dead weight carrying a misleading doc
   comment — restore `managedProject` as the sole, honestly-single-project state, and defer
   multi-project support as a real future feature rather than a half-present one.

Awaiting a decision on which.

## Verification

Not applicable — no fix has been chosen or applied yet. The evidence above was gathered by
direct `grep`/read of `appState.ts`, `liveProject.ts`, and `OriginalShell.vue` against current
`dev` HEAD (commit `ee80d68`), not by trusting any prior session's comments or test-pass status.
