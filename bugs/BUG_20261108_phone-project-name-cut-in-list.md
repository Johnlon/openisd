# BUG_20261108_phone-project-name-cut-in-list

**Status:** RESOLVED

## Symptom
Phone header: the project name "AS168-9-470 passive radiator" sits in a 90 px cell (102 px of text) and its third line "radiator" is cut off. The name takes two lines at most; a longer one is clipped.

## Evidence
AI live review of test v20261108T0823Z, ui-gallery/live-review/20261108T082758Z/sweep-phone/after.checks.json, shot passive-radiator-tab-box: "AS168-9-470 passive radiator (102>90)". Reproduced at 374x705 with the cell set to 90 px: scrollWidth 102 > clientWidth 90, three text lines in a two-line box.

## Cause
`.mob-project-title` (MobileShell.vue) shows at most 2 lines of 14 px / 17 px (`PhoneHeaderSizes.CLASSIC.titleLines`), so a name needing three lines is cut.

## Fix
Header name is 13 px on a 14 px line, up to three lines (42 px, inside the 44 px control), so the name shows whole.

## Verification
mobile-long-project-name-wraps.browser.spec.ts (90 px cell, scrollWidth <= clientWidth, no clipped lines); mobile-header-classic.browser.spec.ts; phoneHeaderSizes.test.ts.
