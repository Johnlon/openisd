# BUG_20261005_driver-editor-dq-tap-cycles-unit-and-fields-resize

**Status:** RESOLVED

## Symptom
On a phone, in the Driver Editor:
- Tapping a field's ⚠ changes the field's unit (Vas L → cu ft, Sd cm² → m², Fs Hz → kHz) instead of showing
  why the value is flagged. A tap gives no way to read the DQ reason.
- The value boxes have no fixed width. They are wide, and they change width when a unit is cycled
  (121px → 169px), so the whole column moves.

## Evidence
Reproduced 2026-10-05 with a Playwright touch probe (412×900, `hasTouch`, `isMobile`), after typing Vas 900:
- `.de-dq` tap on Vas: unit `L` → `cu ft`, input width 121 → 169. Sd and Fs did the same.
- `elementFromPoint` at the ⚠ centre is the `.de-dq` span. Chrome's touch adjustment moves the tap onto the
  nearest clickable node, which is the unit toggle 4px away. The ⚠ span has no click handler; its reason is
  only in a `title`, which a touch screen never shows.
- CDP matched rules for `.de-fld[data-field-key="Vas_m3"] input`: no `.de-fld input` rule from
  `DriverEditorModal.vue` applies. `NumInput` renders a fragment (input + spans), so it does not inherit
  the parent's scope id. The editor's scoped `width: 110px` never reaches the box, and it takes the
  browser default (`size=20`).

## Cause
1. The ⚠ is a passive span carrying only a `title`, next to a clickable unit toggle.
2. The editor's input rules are scoped selectors (`.de-fld input`), which cannot reach `NumInput`'s input.

## Fix
Done 2026-10-05.
1. New `packages/ui/src/ui/components/DqMark.vue`: a ⚠ button. A tap or click toggles the reason open
   under the field row. It replaces all 46 `<span class="de-dq" :title>` sites in `DriverEditorModal.vue`.
2. `DriverEditorModal.vue`: the width rule and the column placement rule use `:deep(input)`. Every value box is
   a fixed 90px, which fits the longest value in any unit (no box clips; checked with Vas in cu in and Vd in
   cu ft). The colour/border rule stays unscoped-deep, so the green/blue entered/calculated colours are kept.

Not covered by this fix: the desktop Box tab Volume ⚠ (`OriginalShell.vue:294,320`) is the same kind of
passive span next to a unit toggle.

## Verification
- New: `mobile-driver-editor.browser.spec.ts` › touch › "tapping a field's ⚠ shows the reason and leaves the
  unit alone; the box keeps one width in every unit".
- `consistency-dq.browser.spec.ts` now reads the title from `.de-dq button`.
- Editor specs (mobile-driver-editor, consistency-dq, driver-editor*): 76/76 pass. `vue-tsc --noEmit` is clean.
