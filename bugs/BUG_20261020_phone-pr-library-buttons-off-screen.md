# BUG_20261020_phone-pr-library-buttons-off-screen

**Status:** FIXED (T501, maryu). Found by John 20 Oct 2026 on his 374x705 phone.

The passive radiator library says "define one below", but the Define new passive radiator and Done buttons sat at the end of the scrolling list and were below the screen once the list was long. Where: `packages/ui/src/ui/components/PRBrowser.vue`. Test: `packages/ui/test/ui/mobile-pr-library-buttons.browser.spec.ts` (with many saved radiators the buttons stay on screen).

**Fix:** the button row is now a footer under the scrolling body of the dialog, so only the list scrolls and the buttons stay put.
