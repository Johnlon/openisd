# BUG_20261025_phone-pwa-stays-on-old-build

**Status:** OPEN

## Report

John, 25 Oct 2026: Chrome and Firefox on his phone continue to show the old OpenISD app after
refreshing; DuckDuckGo on the same phone shows the current app.

## Evidence

- `https://openisd.app/build-info.json` reports `v20261025T0901Z`, the latest GitHub release.
- `https://test.openisd.app/build-info.json` reports `v20261025T0833Z` and is behind production.
- `scripts/hosting/test/hosted-copies.e2e.mjs` documents that builds predating T243 may keep
  serving the old app on reload while a newer service worker waits. Closing and reopening should
  activate the new worker, but restored mobile tabs can keep the old worker client alive.
- Chrome and Firefox both showing the old app, while DuckDuckGo shows the current app, points to
  separate stale browser service-worker caches rather than a stale production deploy.

## Expected

Refreshing or reopening the installed app on a phone reaches the latest production build without
requiring the user to clear site data manually.

## Recovery

The current app has Menu → About → Force refresh, but the affected old app does not. A standalone
same-origin recovery page is being added at `/about/refresh/` so a link can unregister the old
service worker, clear only the app's cached files and reopen the root app. Project data is stored
separately and is preserved. The production URL currently returns 404; do not send it until the
page is deployed.

## Investigation

The production server is serving the latest release. The phone's installed browsers are not
activating the new worker after ordinary refresh. Determine whether the stale worker is pre-T243
and make upgrade recovery reliable without discarding unsaved project edits.
