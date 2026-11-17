# BUG_20261115_phone-driver-name-button-clipped-under-header

**Status:** FIXED in T809

## Symptom
There is one thing, the phone Driver tab's driver-name button, and it is cut off. With a long driver name (Dayton Audio MX6-22) it
wraps to three lines, and its first line sits under the header while its last line sits over the Select driver / Info / Edit buttons.
Production (build v20261108T0032Z) shows one line with an ellipsis; the test site (v20261115T0512Z) shows the cut-off block.
Field-layout rule 2: nothing clipped.

## Steps to reproduce
1. Phone skin at 390 x 844 (or 374 x 705), https://test.openisd.app (any build after 8 Nov 2026, T736).
2. New project, search "MX6-22", pick "Dayton Audio MX6-22 6-1/2" Max-X High Excursion DVC Subwoofer Driver 2 Ohms Per Coil", Next to the end, Create.
3. Open the Driver tab. See: the name button's first line is hidden under the header strip, its last line runs into the buttons row.
Expected: the whole name inside a row that is as tall as the button, the buttons row below it.
Pictures: scratchpad/testsite2/C-before-390x844.png, C-before-374x705.png (live test site), C-prod-390x844.png (live production).

## Evidence
Measured at 390 x 844 on the live test site: row 81 to 121 px (40 px), name button 67.9 to 134.1 px (66.3 px), buttons row starts at 121 px.
So the button starts 13 px above its row (under the header, which ends at 81) and ends 13 px below it (over the buttons row).
The spec `mobile-long-driver-name-fits.browser.spec.ts` (T736) checked only the button's own scroll size, so it passed.

## Cause
`style.css` `.mob-classic .mob-crow` has `height: var(--mob-row-min)` (40 px) and `align-items: center`. T736 (commit 3968f530, 8 Nov)
made `.mob-cname-button` wrap with `height: auto`, but left the row at 40 px: a button taller than the row overflows it equally up and
down. A one-line name (34 px) fits, so nothing showed until a long name.

## Fix
`.mob-classic .mob-crow:has(> .mob-cname-button)` takes `height: auto; min-height: var(--mob-row-min)` and 3 px above and below, so
the row grows with the button. A one-line name keeps the 40 px row (34 + 6).

## Verification
`mobile-long-driver-name-fits.browser.spec.ts` at 374 x 705 and 390 x 844 with the MX6-22 name: failed before (button top 67.875,
page top 81), passes after. Pictures before and after in scratchpad/testsite2/.
