# BUG_20261016_new-build-never-reaches-open-app

**Status:** FIXED by T243

## Symptom
John's phone, /test/, stayed on build 1412Z while 1709Z was deployed. Ten pull-to-refreshes did not move it.

## Cause
vite.config.js uses VitePWA with `registerType: 'autoUpdate'` and `injectRegister: false`; the app registers
sw.js itself (`serviceWorker.ts`, called from `main.ts`). The built worker calls `skipWaiting()` only on a
`{type: 'SKIP_WAITING'}` message, and no page sent it. A new build installed and waited until no tab was open,
so reloads stayed on the old build. Nothing called `registration.update()` either. The old `ReleaseWatch`
banner only reloaded the page, which the waiting worker answered with the old build.
The root worker also answered /test/ with the root shell (`test` was missing from `navigateFallbackDenylist`).

## Fix (T243)
- `AppUpdate` (`packages/ui/src/logic/appUpdate.ts`) keeps the running build in step with the deployed one:
  checks on start, on return to visible and hourly; a waiting worker with nothing unsaved is told to skip
  waiting and the page reloads once; with unsaved edits the user is offered "New version available"
  (Reload / Not now) in both skins.
- `Force refresh` in About: update, unregister, delete this scope's caches, reload. Projects, drivers and
  settings stay.
- `test` added to `navigateFallbackDenylist`.
- The cloud reconnect prompt gets "Not now" (dismissed for the session).
- `ReleaseWatch` and its port are removed: they were the banner that could not work.
