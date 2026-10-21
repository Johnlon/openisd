# BUG_20261021_sealed-box-volume-no-spin-underline

**Status:** OPEN (cause of the reported symptom not reproduced; related defect fixed, see Fix)

## Symptom
John, 21 Oct 2026, live demo, desktop skin: "Not all boxes in the demo support the underline on the spin - Box volume on Closed". Then: it is the Box volume on the Tune (What-if) panel; "maybe it is there but hidden behind the text it collides with". Also: "When spinning - by default start the spin at the 1/10th unit".

## Evidence
- Browser spec `packages/ui/test/ui/box-volume-spin-mark.browser.spec.ts`: on the Box tab (Vented and Closed) and the What-if Vb (Closed), a mouse click on the up arrow keeps focus and marks one digit (selection) at the right place. Passed before any change: the reported lack of a mark did not reproduce with a mouse.
- Touch-style pointer (underline overlay path) on the Box tab and What-if Vb, Vented and Closed: the overlay renders with the underline on the stepped digit in all four; the overlay is on top (pointer-events none) so nothing covers it.
- Reproduced (red): type 20.00, leave the box, click up -> 20.01, not 20.10. NumInput remembers the caret where typing left it (end of text) and steps the hundredths digit.

## Cause
NumInput's `lastCaret` is set by any caret in the box, including the end-of-text caret that typing leaves. A later step then used it instead of the default tenths digit, so the first spin changed the hundredths and the mark sat on the last digit, which on a narrow What-if box (58 px) is at the very edge of the box. ⚠ unverified: this is the closest cause found for John's "hidden" mark; the exact demo state was not reproduced.

## Fix
`steppingCaret` in packages/design/fields/caretSpin.ts: tenths digit unless the caret sits on a digit the person chose (null or end-of-text means default). NumInput uses it. Numbers shown without decimals keep their last (units) digit.

## Verification
`bash scripts/test.sh packages/design/test/fields/caret-spin.test.ts` and the box-volume-spin-mark browser spec.
