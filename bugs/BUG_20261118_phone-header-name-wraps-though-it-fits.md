# BUG_20261118_phone-header-name-wraps-though-it-fits

**Status:** NOT A DEFECT (John's ruling); a test now pins the header's layout

## Report
On the phone (390 x 844, Cloud sync on) a project named "AS168-9-470 closed" shows on two lines in the header; production 7.0.960 shows one.
Cause of the difference: T886 (commit b2282f45, 18 Nov) put `padding-right: 1em` on `.mob-project-title-text` (`MobileShell.vue`) for the clamp's
ellipsis, always, so a name that fitted by under 12 px now wraps.

## Ruling
John, 18 Nov 2026: "header is multiple line , looks ok as long as it doesn't cause header to breakmup" and "it must be truncated to fit and
not damage anything layouts". So wrapping is fine; the header must never break. The padding stays (without it the ellipsis of a
truncated name is cut off).

## Finding
The header already holds: for a short, a three-line and a very long name, at 360 and 390 px, the bar, logo, hamburger, cloud badge, Save,
tab bar and the content's top edge stay exactly where they are, the name stays inside the bar between logo and badge, a name that
does not fit three lines is truncated and its full text is the title. No code change.

## Test
`mobile-header-long-name-keeps-layout.browser.spec.ts` (new; passes on unchanged code).
