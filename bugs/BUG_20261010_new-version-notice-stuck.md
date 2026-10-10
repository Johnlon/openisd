# BUG_20261010_new-version-notice-stuck

**Status:** OPEN

## Symptom
John, 10 Oct 2026: "app is stuck showing new version of OpenISD is available." The mobile notice stays up; Reload does not clear it.

## Evidence
- `ReleaseWatch.check()` (packages/ui/src/logic/releaseWatch.ts) shows the notice whenever `build-info.json` differs from the version baked into the bundle (`VITE_BUILD_VERSION`, vite.config.js `buildVersion()`).
- `buildVersion()` reads `packages/ui/public/build-info.json` in dev mode too, although the comment says the check is off on a dev server ('').
- Every build and every Playwright run rewrites that file in the same checkout (scripts/version-info.mjs), so a running dev server (preview-4000) serves a newer file than the version it baked: the notice shows, and Reload reloads the same stale bundle, so it shows again.
- ⚠ unverified which address John was on (lap:4000 dev, or the published site). On the published site the same loop happens if the service worker keeps serving the old shell after `registration.update()`.

## Cause
Two values hold the build version: the baked bundle value and the served `build-info.json`. On a dev server they drift apart and Reload cannot reconcile them.

## Fix
- Dev server (`vite serve`): bake '' so the check is off, as the comment says.
- Reload: once the reload has happened, a page whose baked version still differs from `build-info.json` does not show the notice again for that version (no loop); log it instead.

## Verification
- Unit: ReleaseWatch with a fake port: after reload with the same mismatch the notice stays hidden.
- Unit: buildVersion is '' for `serve`.
- Browser: mobile shell on the dev server never shows the notice after build-info.json changes.
