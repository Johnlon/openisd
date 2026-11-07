# BUG_20261104_refresh-recovery-reloads-again-after-landing

**Status:** FIXED (T667): AppUpdate gets `controlledAtLoad` from main.ts; the first controllerchange of a page that loaded without a worker no longer reloads. (was: OPEN, found diagnosing CI run 41772431132, land/T666, 4 Nov 2026; not caused by T666)

## Symptom

After /about/refresh/ replaces itself with the latest app (URL /?_openisd_refresh=...), the page
navigates once more about 1.4 s later, to the same URL. A user sees the app load, then reload.

## Cause

`refresh/index.html` unregisters the old worker, so the new page has no controller. The new app
registers its worker (`packages/ui/src/main.ts` registerSw, after load); the worker claims the page;
`controllerchange` fires; `AppUpdate.onControllerChange` (`packages/ui/src/logic/appUpdate.ts`
~line 162) sees nothing unsaved and calls `reloadOnce()` -> `location.reload()`. That reload is
meant for a page running an old build, but here the page already runs the newest build.

## Test

`scripts/hosting/test/legacy-refresh.e2e.mjs:89` reads IndexedDB right after the main bundle
appears. If the reload lands between that check and the evaluate, Playwright throws "Execution
context was destroyed". Passes 5/5 on t666 and 5/5 on main locally (11/11 with CPU load); CI
is slower. A framenavigated probe showed the second navigation at +1.4 s.

## Fix at the source

First controller claim on a page that had no controller must not reload (the page is already the
newest build). Reload only on controllerchange when the page had a controller before.
The test then needs no wait.

Verdict (5 Nov 2026): obsolete. Fixed by T667 (51a30535a), appUpdate.ts controlledAtLoad.
