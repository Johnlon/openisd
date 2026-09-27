# BUG_20260927_box-volume-validity-decided-in-ui

**Status:** OPEN

## Symptom
There are two judges of "is this box volume bad", the UI's `v > 0` check and the domain's
`ventedVolumeIssue`. The UI one covers every box type, the domain one covers vented only.
Move the check into the domain for every box type; both skins read the field's own `.dq`.

## Evidence
Reported by the mobile-skin session, 2026-09-27: `isBadVolume(v) { return !(v > 0) }` and
`volumeDqNote(v)` in `packages/ui/src/logic/boxFieldWiring.ts` (moved unchanged from
OriginalShell.vue / OriginalShell-hooks.ts), applied in `createBoxVolume` to sealed, vented,
bandpass 4th/6th, ABC and passive-radiator volumes. `Engine.ventedVolumeIssue()`
(packages/design/engine/Engine.ts:349) already flags a non-physical vented volume through the
field's `.dq` (test/engine/vented-plausibility.test.ts:136).

## Cause
Pre-existing UI-layer decision; breaks the rule that nothing but display lives outside
packages/design.

## Fix
Domain-side volume validity for every box type, surfaced on each volume field's `.dq`; delete
`isBadVolume`/`volumeDqNote` from the UI and render `.dq` in both skins.

## Verification
Domain tests per box type (0, negative, NaN volume → issue); UI shows the domain's note; no
`v > 0` left under packages/ui.
