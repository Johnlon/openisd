# BUG_20261018_test-build-hangs-on-loading-screen

**Status:** FIXED — T396 (bob). Live until a build with the fix is the root release (7.0.953).

## Symptom
https://openisd.app/test/ stays on the loading screen (dark overlay with the icon) in John's browser on
Windows, 18 Oct 2026 ~13:00Z. No Tailscale involved.

## Known
- GitHub Pages serves the page and all 7 assets (main js, chunk, two css, manifest, icon.svg, sw.js)
  with 200 in about 1 s each (fable).
- A fresh headless Chromium loads /test/ with no console errors and the app renders (fable).
- So the hang depends on state already in John's browser.

## Leads (unproven)
- /test/ shares origin storage (IndexedDB, localStorage) with the production app at openisd.app
  (7.0.952): data written by 7.0.952 may stop the /test/ build's boot.
- The /test/ service worker may serve an older build's files, mixed with new ones.
- Similar hang fixed 13 Oct: BUG_20261013_app-hangs-on-plain-http-host.md (boot threw before the
  overlay was removed).

## Reproduce
One browser context: open https://openisd.app/ twice (its worker takes control), then open /test/.
/test/ stays on the loading screen; its main js 404s; the page's controller is https://openisd.app/sw.js.

## Cause
Two service workers: the root one (/sw.js, 7.0.952, scope /) and /test/'s own. The root worker
answered the /test/ address with its navigation fallback, which is the ROOT build's cached
index.html. That page's ./assets/main-*.js resolved under /test/, where no such file exists, so no
code ran and the overlay stayed. The fallback deny-list (about|install|v|snap) lacked test; source
had added it on 16 Oct (T243), but 7.0.952 predates that. Data in the browser played no part.

## Fix
- vite.config.js: no navigation fallback at all. A worker answers a page only when it holds that
  exact page in its precache; every other address in its scope goes to the network. A deny-list
  cannot name every copy, and the relative base means no build-time pattern can name its own page.
- index.html: a code load error, or an uncaught error before the app shows, replaces the overlay
  with "OpenISD could not start", the reason, Download your data (every openisd_ key) and Reload.
- Tests: packages/ui/test/scripts/vite-config.test.ts (no fallback),
  packages/ui/test/ui/boot-failure-screen.browser.spec.ts, and
  scripts/hosting/test/hosted-copies.e2e.mjs (real builds and workers, the live root build fetched
  from openisd.app), run by scripts/release.sh before every release.
- Prod keeps the bug until 7.0.953 replaces the root worker: only a root release does that.

## Why the tests missed it
Every browser test starts with fresh storage and no service worker, so nothing tests an upgrade
from a released build. Fix: an upgrade test against real build URLs, wired into the release
script or the post-land run:
1. (T396) Previous released build in a browser context, create and save a project, then the same
   context opens the new build: it gets past the loading overlay and shows the project.
2. (follow-up task) Previous build's service worker installed, then the new build: it updates and
   reaches the app.

## Also wrong
A boot failure leaves the overlay up forever with nothing on screen: the user gets no message and
no way out. Any boot error must show a message and a way to reach the app's backup/export.
