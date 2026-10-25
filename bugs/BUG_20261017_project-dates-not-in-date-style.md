# BUG_20261017_project-dates-not-in-date-style

**Status:** FIXED (T263)

## Symptom
The Project tab's Created and Modified boxes showed "2026-10-16", in both skins. Every other date the
app shows follows the date rule ("16 Oct 2026, 23:32", one design formatter). John, 17 Oct 2026: these
boxes follow the rule too. That replaces the yyyy-mm-dd display asked for on 29 Sep.

## Cause
The boxes had their own display code in the UI (`packages/ui/src/logic/dateDisplay.ts`), outside the
design formatter.

## Fix
- `formatDateStamp` and `dateStampFrom` in `packages/design/fields/format.ts`:
  - The stored stamp stays WinISD's `YYYYMMDD`, which holds no time, so the boxes show the day: "16 Oct 2026".
  - A typed date is read as "16 Oct 2026" (any letter case), "2026-10-16" or "20261016".
  - Text that names no real day keeps the stored date. The UI file is deleted.
- Found while testing typing key by key:
  - The boxes wrote on every key. A half-typed "2026-10-1" was already a real day, so the box redrew under the typist ("1 Oct 20266"). The boxes now write when the typist is done (Enter or leaving the box).
  - A date typed in another form for the same day ("2026-10-16" over 16 Oct 2026) stored no change, so the box kept the typed form. The boxes are now redrawn after each commit.
- Specs: `original-project-dates.browser.spec.ts`, `mobile-project-tab.browser.spec.ts`, and unit tests in `format-date.test.ts`.

Before and after: http://lap:8000/winisd/zoo/briefs/dates/project-tab-dates-before-after.png
