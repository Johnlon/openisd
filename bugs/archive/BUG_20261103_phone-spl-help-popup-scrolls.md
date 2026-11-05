# BUG_20261103_phone-spl-help-popup-scrolls

**Status:** WONTFIX

## Symptom
On the phone, the SPL chart help popup (the (?) button on the SPL chart) shows a scrollbar: its
text is a few pixels taller than the popup box, so the last line needs a scroll. Every other chart
help popup fits.

## Evidence
Live test build v20261103T0301Z (main at T654), phone viewport 374x705 at DPR 2.566, sample vented
project, SPL chart, (?) opened: the popup sheet measures scrollHeight 474 px against clientHeight
467 px (7 px over). The other 15 chart popups measured on the same build have
scrollHeight <= clientHeight. Probe: the prod vs test review page QO394,
http://lap:8000/winisd/ui-gallery/reviews/prod-vs-test-20261103/index.html.
Production v20261031T1739Z has only a one-line SPL popup, so it does not show this.

## Cause
T648 (f28eed6af) made the SPL help text in `packages/design/fields/chartHelpText.ts` longer, and the
sheet's height does not grow to fit it at 374 px wide. ⚠ unverified whether the sheet has a fixed
max height or the text alone is too long.

## Fix
Make the help sheet fit its text at phone width with no scrollbar (CLAUDE.md UI layout rule: no
unwanted scrollbars). Do not cut the text to fit unless the sheet cannot grow.

## Verification
Browser spec at 374x705: open each chart's (?) popup and assert scrollHeight <= clientHeight for every
chart, the SPL one included. It fails on main today.

## Ruling
John, 3 Nov 2026: "if the help popup scrolls then it's not a disaster as long as the contents are good
quality and the UI is clean". The sheet's 80% height cap with its own scroll is kept. T656 cut the SPL
popup's links to one (Eminence), which also shortens it.

Verdict (5 Nov 2026): incorrect. John's ruling of 3 Nov 2026 accepts a scrolling help popup.
