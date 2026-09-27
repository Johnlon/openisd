# BUG_20260927_box-volume-validity-decided-in-ui

**Status:** RESOLVED

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
New `InvalidVolumeIssue` DqIssue kind (`packages/design/engine/consistency.ts`) — zero, negative
or non-finite, box-agnostic — with its own text (`invalidVolumeToText`, the old UI wording,
unchanged) and an `Engine.boxVolumeIssue(value)` wrapper, following the same
type-function-Engine-method-dqIssueText-dispatch pattern every other `DqIssue` kind already uses.
Kept separate from `VentedPlausibilityIssue`'s own `non-physical`/`out-of-range`: vented's text
ends in the alignment-extrapolation PARITY sentence, which is wrong for a directly-entered
volume, so vented keeps `ventedVolumeIssue`/`VentedPlausibilityIssue` exactly as before.

Wired onto every OTHER box type's volume field the same way `ventedChamber.volume_m3` already
reached `ventedVolumeIssue` (`requiredField(..., (v) => engine.boxVolumeIssue(v))`):
sealed and passive-radiator moved from a bare `SimpleField<number>` (no `.dq` at all) to
`Readable<number> & Entered & Writable<number>`; bandpass4 rear/front and `VentedChamberWindow`
(shared by bandpass6 and ABC, both rear and front) gained the `getDq` callback they already had
the field type for.

`packages/ui/src/hooks/OriginalShell-hooks.ts`: deleted `isBadVolume`/`volumeDqNote`/
`BAD_VOLUME_NOTE`. `createBoxVolume` now resolves the active box's volume FIELD (not just its
value) and reads `boxVolumeDqNote` from `field.dq.map(engine.dqIssueText)` — the same `.dq`
surface vented's own field already exposed, so the not-yet-merged mobile skin needs no
special-casing. `BoxVolumeDeps` gained an `engine: Engine` field.

## Verification
New domain test `packages/design/test/domain/box-volume-validity.test.ts`: one test per box type
(sealed, bandpass4 rear/front, bandpass6 rear/front, ABC rear/front, passive-radiator), each
setting 0 / negative / NaN and asserting `{kind: 'invalid-volume', value}` on the field's `.dq`,
plus one test pinning that vented's own field still reports `VentedPlausibilityIssue`
(`non-physical`), untouched. `packages/design` full suite: 2220/2220 passed, no regressions.

`packages/ui/test/hooks/OriginalShell-hooks.test.ts`: removed the `isBadVolume`/`volumeDqNote`
describe block; the zero-or-less-volume test now compares `boxVolumeDqNote` against
`engine.invalidVolumeToText(...)` rather than the deleted `BAD_VOLUME_NOTE` constant.
`packages/ui` unit suite: 585/585 passed.

`grep -rn "v > 0" packages/ui/src` still finds six hits, none a volume check (a `NumInput`/
`expoStep` decimal-step helper, `OgTune`/driver-editor/options-modal field checks, and a
driver-display usability predicate) — no volume check remains under `packages/ui`.
