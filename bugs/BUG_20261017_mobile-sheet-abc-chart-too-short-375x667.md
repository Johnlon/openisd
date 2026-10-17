# BUG_20261017_mobile-sheet-abc-chart-too-short-375x667

**Status:** OPEN (found by T274, wider phone sizes)

## Symptom
On a 375x667 phone (iPhone SE) the ABC Tune sheet leaves the chart 59 px tall; it must be at least 120 px.

## Evidence
Spec: packages/ui/test/ui/mobile-sheet-fit.browser.spec.ts (chart must be at least 120 px tall with the Tune sheet open).
Screenshot: /home/john/work/winisd/visual-pages/phone-sizes/abc-375x667.png (http://lap:8000/visual-pages/phone-sizes/index.html)
