# BUG_20261005_no-common-ui-field-component

**Status:** OPEN

## Symptom
A number field (LABEL, VALUE, DQ, UNIT) is hand-built at every site, and the parts behave differently in
each place:
- The ⚠ is built four ways, and three of them can't be read on a touch screen (title-only):
  - `NumInput`'s own `dq-note` span (title only)
  - the driver editor's `DqMark` (tap opens the reason)
  - What-if's span (hover tooltip, click to pin)
  - Box tab Volume's span (title only)
- Box widths differ by site. Only the driver editor is fixed (90px).
- An emptied box stores 0 at some sites (`set(v ?? 0)`) and clears at others.
- The PR spec fields show no ⚠ at all (BUG_20261005_pr-spec-fields-show-no-dq).

## Evidence
Checked 2026-10-05:
- `DriverEditorModal.vue`: 46 copies of `.de-fld` > label + `NumInput` + `DqMark` + `UnitToggle`.
- `OriginalShell.vue` and the mobile tabs repeat their own `.field` / `.mob-field-row` rows around `NumInput`.

## Cause
There is no field component. Every site assembles the four parts itself.

## Fix
One `UIField` component: LABEL | VALUE | DQ | UNIT, bound to a domain cell and a `NumberField`.
- Reads value, provenance colour, precision, mandatory state and DQ from the cell.
- An empty box calls `clear()`; a number calls `set(v, precision)`.
- The ⚠ opens its reason on tap or click, the same on phone and desktop.
- The box and unit have fixed widths. A parent grid can line the four tracks up with `subgrid`.
- Change notification comes from a typed `CellScope` that the hosting view provides.

Migration order, each step its own commit with browser tests:
1. Driver editor
2. PR pane (both shells)
3. The rest of both shells
4. What-if

## Verification
- Browser spec on `UIField` in the editor: tap ⚠ shows the reason, the unit is untouched, the width is the
  same in every unit, and an empty box clears.
- Every migrated view's existing specs pass.
