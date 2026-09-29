# BUG_20260929_mobile-skin-narrow-strip-on-phone

**Status:** WONTFIX

## Symptom
On John's phone (Chrome, "Desktop site" not ticked), https://openisd.app shows the mobile skin as
a narrow strip down the middle of the screen with grey margins, the text rendered small, as if the
whole page were zoomed out. Box tab, closed box, project open (screenshot 2026-09-29 16:33).

## Evidence
- In the screenshot the mobile column spans 500 of 896 px (56%). `.app-root-mobile` caps at
  480 px (`packages/ui/src/ui/App.vue`, `max-width: 480px; margin: 0 auto`), so the phone laid
  the page out about 860 CSS px wide instead of its ~412 px device width.
- The deployed page carries `<meta name="viewport" content="width=device-width, initial-scale=1">`
  (build `v20260929T114457Z`).
- Not reproduced in Playwright Pixel 7 emulation (412 px) against the same code with the sample
  project open: `scrollWidth` 412, no element wider than the viewport, visual scale 1.

## Cause
⚠ unverified. Something on the real device is wider than the screen, so Chrome shrinks the page
to fit. The emulated run finds no such element, so it depends on the real device or on stored
state (stored UI/project state, fonts, text autosizing).

## Fix
Find the wide element on a real device (Chrome remote debugging: `document.documentElement.scrollWidth`
and elements whose `getBoundingClientRect().right > innerWidth`), then constrain it.

## Verification
On the phone, `document.documentElement.scrollWidth === innerWidth` and the mobile column fills
the screen on every tab.

## Ruling
Not a bug (John, 2026-09-29): "it is my fault - I was using the mobile view in chrome on a phone
with the desktop view selected". Chrome's Desktop site mode lays the page out ~980 px wide, above
the 600 px automatic mobile breakpoint (`logic/viewport.ts`), so the automatic choice was the
desktop skin; the stored manual "Switch to Mobile view" override beat it, as designed, and the
480 px mobile column sat centred in the 980 px page.
