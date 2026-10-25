# BUG_20261017_phone-sheet-controls-too-small

**Status:** FIXED (T346): every control in both sheets is at least 44x44 px and rows at least 48 px.

## Symptom
In the phone Tune and What-if sheets the ▲▼ steppers are about 20 px wide and the rows are tight. John:
"buttons too small to be practical".

## Fix
Sizes are in packages/design (`SheetSizes`: 44 px controls, 48 px rows, 44 px pull-tab); the hook hands them to
the sheet as CSS variables. Rows scroll inside the sheet when the phone is short; the chart keeps 120 px.

## Verification
`mobile-sheet-touch.browser.spec.ts` measures every button, input and unit toggle in both sheets on all six
phone sizes (vented and passive radiator).
