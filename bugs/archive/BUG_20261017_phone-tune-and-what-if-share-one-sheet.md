# BUG_20261017_phone-tune-and-what-if-share-one-sheet

**Status:** FIXED (T336): two sheets, each from its own pull-tab; Learn is What-if again.

## Symptom
There is one phone sheet, labelled "Tune", and What-if hides behind a "Learn" toggle in its footer.
Tune and What-if are different things (John, 17 Oct 2026: "tune is actually changing the project,
what if is for experiments for learning, they have different fields"). We need two sheets, each
from its own pull-tab, side by side: "Tune ▲" and "What-if ▲", no toggle, and "Learn" renamed back
to "What-if" everywhere the user sees it.

## Evidence
Screenshots of before and after: /home/john/work/winisd/visual-pages/whatif-tune/index.html
(before) and /home/john/work/winisd/visual-pages/tune-whatif-split/index.html (before and after).

## Cause
T209 to T231 built one sheet with a mode switch (PLAN_20261015_TUNE_SHEET.md); the ruling of
17 Oct replaces it.

## Fix
- Two `MobileSheet` instances, each with a fixed `SheetMode` (Tune, What-if); no mode toggle.
- Tune fields: the box figures, power and drivers, with real short names ("Box volume", "Added
  mass", "Radiators", "Power", "Drivers"). What-if fields: those plus the driver's Fs, Qts, Vas.
  Names and field lists live in `packages/design/fields` (`SheetField`, `SheetMode`).
- Each sheet keeps one fixed height while open; the chart keeps 120 px; rows scroll inside the sheet.

## Verification
`mobile-sheet.browser.spec.ts` (tabs, strings, edits), `mobile-sheet-fit.browser.spec.ts` (vented,
passive radiator and ABC, both sheets, all six phone sizes), `mobile-sheet-port.browser.spec.ts`.
