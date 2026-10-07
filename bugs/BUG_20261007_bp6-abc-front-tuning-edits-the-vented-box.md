# BUG_20261007_bp6-abc-front-tuning-edits-the-vented-box

**Status:** OPEN

## Symptom
On a 6th-order bandpass or ABC box, the Front chamber tuning box (Ffc) on the Box tab shows and edits the vented box's
tuning, not the front chamber's. The front chamber's own tuning is never reachable, so the sweep stays blocked.

## Evidence
Run 2026-10-07 (tsx script): `box.ventGroupOf('bandpass6').tuning_goal_hz === box.vented.tuning_goal_hz` is true; same for `abc`.
- `OpenISDBox.ventGroupOf` special-cases bandpass4 only, then `return this.vented` (`packages/design/domain/box/openISDBox.ts:391-396`).
- Desktop Ffc binds `activeTuning` (`OriginalShell.vue:343`), which is `ventGroupOf(selectedBox).tuning_goal_hz` (`ventReadouts.ts:48-52`).
- The sweep reads `bandpass6.chambers.front.tuning_goal_hz` (`projectSweep.ts:~207`), so an Ffc entry never reaches it.
- The mobile Front chamber panel has no Ffc row at all (`MobileBoxTab.vue:68-74`).

## Cause
`ventGroupOf` has no bandpass6 or ABC case, and the Vents pane for these types is static text, so `activeVent` is also the vented box's vent.

## Fix
`ventGroupOf` returns the front chamber (volume, tuning, front vent) for bandpass6 and ABC; a rear group is added for Frc.
Mobile gets an Ffc row. See plan step 3.

## Verification
- New domain spec: `ventGroupOf('bandpass6')` and `('abc')` are the front chamber's own cells, and setting its tuning changes `sweepPlan`.
- New hook spec on `createVentReadouts` for both types.
