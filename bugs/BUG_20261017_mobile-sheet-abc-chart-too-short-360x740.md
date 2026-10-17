# BUG_20261017_mobile-sheet-abc-chart-too-short-360x740

**Status:** OPEN (found by T274, wider phone sizes)

## Symptom
On a 360x740 phone the ABC Tune sheet leaves the chart 91 px tall; it must be at least 120 px.

## Evidence
Spec: packages/ui/test/ui/mobile-sheet-fit.browser.spec.ts (chart must be at least 120 px tall with the Tune sheet open).
Screenshot: /home/john/work/winisd/visual-pages/phone-sizes/abc-360x740.png (http://lap:8000/visual-pages/phone-sizes/index.html)
