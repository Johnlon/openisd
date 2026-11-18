# BUG_20261118_fonts-spec-asks-the-live-site-for-stylesheets

**Status:** FIXED (T900)

## Symptom
One sentence: after the visual pictures moved to https://openisd.app/ (T896), 183 visual-fonts screens failed on main (suite run 44301107347) with "console errors (2): Failed to load resource: the server responded with a status of 404 ()".

## Cause
- `visual-fonts.browser.spec.ts` reads the page through the browser's developer protocol (`CSS.enable`, `CSS.getPlatformFontsForNode`). The protocol fetches the page's two stylesheets again (assets/main-<hash>.css and assets/SplashContent-<hash>.css), from the page's own address, outside Playwright's routing: no route answered it (no handler ran, no response was seen).
- At https://openisd.app/ that request went to the real site, which has no file of those hashes: 404. At the test server's address the same request is answered. The console message's location (`msg.location().url`) named exactly those two stylesheets.
- The stand-in `packages/ui/test/fixtures/releaseSite.ts` itself answers every path of the test build with 200; it was not the one answering 404.

## Fix
- `Screen.openOnServer` (packages/ui/test/visual/screens.ts): the same screen opened at the test server's address. `visual-fonts.browser.spec.ts` uses it, so it still checks every screen's glyphs, with the diagnostics unchanged. The pictures (visual.browser.spec.ts) stay at the release address.

## Tests
- `packages/ui/test/visual/visual-fonts.browser.spec.ts` and `visual.browser.spec.ts`: 0 failures locally.
