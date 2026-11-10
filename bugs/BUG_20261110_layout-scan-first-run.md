# The first exhaustive layout scans found faults on 21 phone views and 7 desktop views

Status: FIXED except one known (10 Nov 2026). `layout-scan.browser.spec.ts` (58 phone views at 374 px) and `layout-scan-desktop.browser.spec.ts` (130 desktop views at 1280 x 720 and 1440 x 900) pass with no known-fault entry. `layout-long-values.browser.spec.ts` (the longest value of every field in every unit fits its box) has four known entries.

Open, needs John: on the phone Box tab (vented, bandpass 4th, bandpass 6th, ABC) the Vb top limit shown in cm3 (100000000) is 76 px wide and the box text area is 68 px. Choose: lower the Vb top limit, or give the Box tab a narrower label column.

Each fixed fault, with what was wrong and the fix: `ui-gallery/T742-phone-clip/scan-result.json`. Pictures: `ui-gallery/T742-phone-clip/pairs/`.
