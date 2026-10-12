# appState and presentationState are constructed by the composition root, not by their modules

John, 12 Oct 2026: "one of my rules was no global state"; "ok injected it".

## The problem

`packages/ui/src/logic/appState.ts` and `presentationState.ts` hold the live app state (open
projects, focus, curves, settings, presentation flags) in module scope, parked on `globalThis`
through `hmrSingleton.ts`. Every importer, 26 source files and 25 test files, gets the one
instance. With unit workers sharing a module cache (vitest `isolate: false`) one test file sees
another file's open project: `projectRegistry.test.ts` and `appState-sweep-range.test.ts` go red
in the full run and are green alone.

## The design

1. `appState.ts` exports one factory, `createAppState(deps): AppState`, and the `AppState`
   interface. Every current `export const`/`export function` becomes a member of the returned
   object, same names, same types. Module scope holds types and pure helpers only. `deps` is what
   the module today reaches for itself: `engine` (the one engine), `appSettings` repo.
   `installAppSettings` goes: the repo is a constructor dependency.
2. `presentationState.ts` likewise: `createPresentationState(): PresentationState`.
3. `hmrSingleton.ts` is deleted. The composition root (`main.ts`) holds the two instances; a
   hot reload of main.ts reloads the page, which is what Vite does for the entry anyway.
4. Providing: `AppLogic` (in `app.ts`) gains `appState: AppState` and `presentation:
   PresentationState`. Components and hook files already call `useApp()`; they read
   `useApp().appState.<member>` or destructure once in setup. New helpers `useAppState()` and
   `usePresentation()` in `app.ts` are allowed only if they do more than forward (they do not;
   so no helpers, use `useApp()`).
5. Non-component logic that imported members (`compareOverlays.ts`, `passiveRadiatorActions.ts`,
   `applicationIO.ts` if it does, anything else `grep` finds) takes the `AppState` as a parameter
   or constructor argument. No module may import the instance.
6. `testHooks.ts`: `TestHooks { appState: AppState; presentationState: PresentationState }`,
   main.ts passes the instances. Browser specs are unchanged (they read the global seam).
7. Tests: each test file calls `createAppState({engine: createEngine(), appSettings: <in-memory
   repo>})` in `beforeEach` (or once per `describe` where the file is a scenario). No shared
   instance across files. `vitest.config.ts` ui project stays `isolate: false`.

## Rules

- Type discipline (CLAUDE.md): no casts, no `any`, no string-keyed lookups. The `AppState`
  interface is explicit, not `ReturnType<typeof createAppState>`.
- No convenience wrappers: a member whose body only forwards to another member is removed, and
  callers use the target.
- `packages/design` is untouched. UI stays display only.
- Prove with `bash scripts/test.sh` on the ui test files touched, then
  `bash scripts/quiet-test.sh npm run typecheck` and `bash scripts/land/lint-changed.sh <files>`.
- Commit everything in the worktree, often, hooks on, no AI attribution.

## Done when

`bash scripts/test.sh packages/ui/test/logic/projectRegistry.test.ts packages/ui/test/logic/appState-sweep-range.test.ts packages/ui/test/logic/project-open-once.test.ts packages/ui/test/logic/urlAppState.test.ts`
passes, typecheck and lint are green, `grep -rn "hmrSingleton\|getOrInit" packages/ui` is empty,
and `git grep -nE "^export (const|let) [a-zA-Z_]+ *= *(ref|shallowRef|reactive|computed)\(" packages/ui/src` is empty.
