# BUG_20261009_pr-added-mass-can-be-cleared-to-blank

**Status:** FIXED (T211)

There are two things, the added-mass box and the tuning-goal box on a passive radiator. They are a
pair: entering one makes the other calculated (`packages/design/domain/box/openISDBox.ts:342-356`,
`pairedField`). Clearing the added mass leaves neither entered, so the box is blank and the
calculation has no input. A default of 0 is applied only on one path (`openISDBox.ts:554`:
`if (!addedMass.entered && !tuning.entered) addedMass.set(0)`); clearing the box in the UI does not
reach it.

We need: clearing the added mass sets it to 0 (entered), exactly as the default does.

Then a sweep, ask John per field: list every entered field that can be cleared to blank (use the
Field enum in packages/design) and for each name the sensible default a clear should give, or say
"blank is meaningful". Write the answers into the fields, test first, one test per field.

## John's rulings on the sweep (2026-10-09)
- PR added mass: a clear is entered 0, the tuning is calculated (done in `openISDBox.ts`, `pairedField` settle).
- Port diameter / height / area: a clear settles to a 50 mm round port (or a slot sized from the driver).
- Port width: from the driver's Dd.
- PR count and driver count: 1.
- Rg: a clear goes back to 0.1 ohm.
- NOT ruled yet, no change: PR and vented volumes, bandpass / ABC values, Ql / Qa / Qp / Qicl,
  port end correction, filters.

## John's rulings on the rest (2026-10-16)
- Box volumes (vented, PR, bandpass, ABC): a clear goes back to the alignment's volume.
- Ql / Qa / Qp / Qicl: a clear goes back to the WinISD default. "Why would we want blank."
- Port end correction: it is a drop-down; it cannot be blank. If any path lets it blank, that is the bug.
- Filters: a cleared value stays empty, and an empty box that stays empty (filter frequency etc.) is marked red.

## John's rulings, 16 Oct 2026 evening (replace the above where they differ)
- Linked groups follow the group rule in BUG_20261016_clearing-a-linked-pair-member-is-inconsistent.md
  (a deleted E becomes the group's sole C, or N when it cannot be calculated).
- Box volume: "box vol is sometimes in a group like qtc and f". Where it is in a group (sealed:
  Vb, Fsc, Qtc), the group rule applies.
- Ql: a clear goes to the default.
- Driver, PR and port counts: a clear goes to 1, and that 1 is shown as C, "their calculated
  default value", not E.
- Rg: asked by John, not ruled yet.

## Fix
- Box volumes:
  - Vented volume: settles to the current alignment volume (`#ventedAlignmentVolume()` using `driver.ventedDesign`).
  - Passive radiator volume: settles to starting shared volume `STARTING_SHARED_VOLUME_M3` (7 L).
  - Bandpass 4 rear & front volumes: settle to `startingChambersOf('bandpass4')` (7 L rear, 10 L front).
  - Bandpass 6 rear & front volumes: settle to `startingChambersOf('bandpass6')` (30 L rear, 20 L front).
  - ABC rear & front volumes: settle to `startingChambersOf('abc')` (30 L rear, 20 L front).
- Loss factors:
  - Ql, Qa, Qp across sealed, vented, PR, bandpass4, bandpass6, ABC: settle to `WINISD_BOX_LOSSES.Ql` (10), `Qa` (100), `Qp` (100).
  - Interchamber Qicl (`Qiclfr`) on bandpass4, bandpass6, ABC: settles to `WINISD_BOX_LOSSES.Qicl` (100).
- Fields allowed to stay empty:
  - Filter fields (fc, Q, gain, order, t, bw) have `allowedEmpty: true` and answer `emptyAndAllowed(value)`.
  - Empty allowed fields receive `.value-empty` styling (red border and red background tint) across both Original and Mobile skins.
