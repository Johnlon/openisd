# BUG_20261029_app-fails-to-start-offline

**Status:** OPEN

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
Offline, a page request the worker cannot match must still get this copy's app shell: answer
navigations to this build's own pages with its precached index.html whatever the query, while
the hosted copies (v/, snap/, test/) stay out of the root worker's answers. Then find John's
actual route (device, address, build) and pin it with a test.

## Verification
A browser spec: install the worker, go offline, open `/`, `/?x=1`, and the installed app's
start address; each shows the app, not the browser's offline page. Repeat on a phone browser.
