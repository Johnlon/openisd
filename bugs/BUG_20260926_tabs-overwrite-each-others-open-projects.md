# BUG_20260926_tabs-overwrite-each-others-open-projects

**Status:** RESOLVED

## Symptom
With the app open in two tabs (T1 with project A, T2 with projects B and C), a new tab T3 shows
only the projects of whichever tab last refreshed or edited. The tabs never show the same thing.
Expected (John, 2026-09-26): every tab shows the same open projects, whatever tab they were
opened or edited in.

## Evidence
- `saveOpenProjects` replaces the whole open-session record under one storage key:
  `packages/persistence/src/repos/projectRepo.ts:266-274`.
- `App.vue:58-83` calls it on boot and on every project edit / open / close / focus change.
- No tab listens for other tabs' writes: grep for a `'storage'` event listener or
  `BroadcastChannel` under `packages/ui/src` and `packages/persistence/src` finds none.
- The view snapshot (`viewStateRepo.save`) is also one key, same behaviour.

## Cause
Tabs share one open-session record and one view record. Each tab overwrites them with its own
in-memory state and never reads the other tabs' writes back.

## Fix
One shared session for all tabs (John, 2026-09-26: "3 makes sense").
- `KeyValueStorage.watch(key, onChange)` — fires when another tab changes the key (browser
  `storage` event). `ProjectRepo.watchOpenProjects`, `ViewStateRepo.watch` expose it per record.
- `packages/ui/src/logic/sessionSync.ts` `startSessionSync` — saves this tab's changes and adopts
  other tabs' writes. Replaces the save watchers that were in `App.vue`.
- An adopted session is not saved back: reading a project gives its embedded driver a new id, so
  saving it back would change the text and the tabs would keep sending the same record to each other forever.
- View saved as sorted-key JSON so an unchanged view is unchanged text.

## Verification
- `packages/ui/test/persistence/tabs-share-one-session.browser.spec.ts` — 4 two-tab specs, red
  before, green after.
- `packages/persistence/test/tabSharing.test.ts`, `packages/ui/test/logic/sessionSync.test.ts`.
