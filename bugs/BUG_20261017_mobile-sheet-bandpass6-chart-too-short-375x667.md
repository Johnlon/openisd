# BUG_20261017_mobile-sheet-bandpass6-chart-too-short-375x667

**Status:** FIXED (T285): the sheet shrinks before the chart does, the chart keeps 120 px and the rows scroll inside the sheet.

## Symptom
On a 375x667 phone (iPhone SE) the 6th order bandpass Tune sheet leaves the chart 59 px tall; it must be at least 120 px.

## Evidence
Spec: packages/ui/test/ui/mobile-sheet-fit.browser.spec.ts (chart must be at least 120 px tall with the Tune sheet open).
Screenshot: /home/john/work/winisd/visual-pages/phone-sizes/bandpass6-375x667.png (http://lap:8000/visual-pages/phone-sizes/index.html)
