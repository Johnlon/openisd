# BUG_20261029_app-fails-to-start-offline

**Status:** RESOLVED (T612)

## Symptom
John, 29 Oct 2026: "I was disconnected from the internet and the app failed to start." Serious:
an installed web app must start with no network.

## Evidence
Reproduced 29 Oct 2026 against https://openisd.app/ (build 25 Oct, 7.0.956) in Chromium,
phone viewport, with the service worker installed and controlling the page, then offline:
- `https://openisd.app/` starts offline (the No project open screen).
- `https://openisd.app/?pwa=1` does not: the browser's "no internet" error page
  (`net::ERR_INTERNET_DISCONNECTED`). Any address with a query string fails the same way.

Not yet known: which address John's device opened (installed app, browser tab, bookmark, link),
which browser, and which build its worker held. A worker stuck on an old build
(BUG_20261025_phone-pwa-stays-on-old-build) is a second possible route.

## Cause
`vite.config.js` sets `navigateFallback: null`, and the precache matches a page address exactly
(Workbox ignores only `utm_*` and `fbclid` parameters). A page address with any other query is
not in the precache, so the worker sends it to the network, which fails offline. The fallback
was removed on purpose (BUG_20261018_test-build-hangs-on-loading-screen): the root worker's scope
also covers the copies under v/, snap/ and test/.

## Fix
`vite.config.js` workbox `ignoreURLParametersMatching: [/.*/]`: the precache matches a page address
with its query removed, so `/?pwa=1`, `/about/?y=2` and the like get this build's precached page
offline. No navigation fallback was added: the hosted copies (v/, snap/, test/) are not in this
build's precache, so the root worker still sends them to the network.

Still open: which address and build John's device used. A worker stuck on an old build is
BUG_20261025_phone-pwa-stays-on-old-build.

## Verification
`node scripts/hosting/test/offline-start.e2e.mjs` (also in the GitHub suite, shard 1): a real
production build with its worker in control, taken offline; `/`, `/?x=1`, `/?pwa=1`,
`/index.html?x=1` start the app, `/about/`, `/about/?y=2`, `/install/?z=3` show their own page,
and `/test/`, `/test/?x=1` are not answered by the root worker. Red before the fix (5 failed),
green after. `legacy-refresh.e2e.mjs` still passes.
