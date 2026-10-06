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

Step 1 done: `4c41761a`. `UIField` taking a domain cell is allowed by ruling QO173.

## Rulings (John, 2026-10-06)
- Emptied box: "just show errors". The box stays blank with a ⚠; no invented default and no 0. Applies to
  box volume (must be > 0), losses Ql/Qa/Qp, Rs, VC temp rise and driver added mass. These domain fields become
  "number or nothing", and every reader handles "nothing".
- PR added mass: solved from target tuning when one is set; otherwise blank with a ⚠.
- Air temp / humidity / pressure and drive V: "NO", "leave them". They keep snapping back to their default.
- The ⚠ gives "the user the info they need to fix it": what is wrong, the other fields involved, the allowed
  range in the unit shown, and what clears it.
- Wording: an entered value reads "Conflicts with other values: …"; a calculated one reads "Calculated from
  flagged values: …".
- The losses popup gets a Reset button back to WinISD's defaults (Ql 10, Qa 100, Qp 100).
- `de-fld` (driver editor field) leaves `UIField`; fields use `ui-field` everywhere, and `de-` stays on
  editor-only containers.
- An architecture test bans `?? 0` in a box's update handler.
- PR target tuning above the bare-cone natural tuning: "if we have a rule to prevent going to a freq above the
  natural freq then keep it". Today only the desktop box enforces it (`:max="prNaturalFh"`, OriginalShell.vue);
  the mobile box has no limit. The ceiling moves onto the domain field, so `UIField` applies it in every view.
- "keep mobile in line with desktop": every rule and limit a desktop box has, the mobile box has too. Today
  these mobile boxes bind no registry field and so have no limits: Box tab volume, front volume, Frc, Fb
  target, sealed alignment volume, Ql/Qa/Qp; Enclosure tab vent width/height/diameter/length, vent tuning,
  port velocity limit; Signal tab Rs. Moving them to `UIField` binds the field and closes the gap.
- "add 2 to the plan - ok": quantities that cannot physically be 0 get a registry minimum above 0
  (`fields/field.ts`), so a typed 0 is refused at the box (red, nothing stored, reverts on leaving) with the
  agreed ⚠ text. Fields: driver Qts, Qes, Qms, Vas, Mms, Cms, BL, Rms, Dd, Xmax, Pe, Znom, Mpow; box Fb target,
  vent cross-section area; PR Xmax. 0 stays allowed where it means "none": Le, added mass, VC temp rise,
  Rs, Gloss, AlfaVC.
- A refused entry ("b"): the box keeps the refused text, red, with the ⚠ from the field's own limits, until
  it is fixed or Esc restores the stored value. Leaving the box does not revert it. Nothing invalid is ever
  stored; meanwhile the charts use the last stored value. Two error sources: the box (typed text invalid,
  from the registry limits) and the domain (stored values missing or in conflict, from `cell.dq`).

## Temporary debt — remove when the last screen uses UIField
`NumInput` still draws its own ⚠ (`dq-note`, `dq`/`dqState` props) for the screens not yet moved, and
`UIField` turns that off with `hideMark`. That is `NumInput` doing two jobs. Once every screen uses `UIField`:
delete `NumInput`'s ⚠, its `dq`/`dqState` props and `hideMark`. `NumInput` is then the value box only (typing,
units, limits, red border, reporting a refusal); `UIField` owns the ⚠.

## Verification
- Browser spec on `UIField` in the editor: tap ⚠ shows the reason, the unit is untouched, the width is the
  same in every unit, and an empty box clears.
- Every migrated view's existing specs pass.
