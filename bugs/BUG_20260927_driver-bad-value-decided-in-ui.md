# BUG_20260927_driver-bad-value-decided-in-ui

**Status:** OPEN

## Symptom
There are two judges of "this driver value is bad (≤ 0)", the driver editor's `isBadValue` /
`dqNoteFor` (packages/ui/src/hooks/DriverEditorModal-hooks.ts) and Tune's `dqNote`
(packages/ui/src/hooks/OgTune-hooks.ts), each with its own copy of `BAD_VALUE_NOTE`. Neither is the
domain. The domain must mark a non-physical driver value on the field's own `.dq`; the UI shows `.dq`
only. John, 2026-09-27: "This is awful".

## Evidence
Both files hold `!(v > 0)` and the same message string; the domain's `.dq` for the field does not
carry the fact.

## Cause
UI-layer decision; breaks "nothing but display lives outside packages/design". Same shape as
BUG_20260927_box-volume-validity-decided-in-ui (resolved): follow that fix (`InvalidVolumeIssue` via
the field's `.dq`, text by `engine.dqIssueText`).

## Fix
Domain issue for a non-physical driver spec value on that field's `.dq` (which fields must be > 0 is
the domain's list, not the UI's); delete `isBadValue`, `dqNoteFor`'s special case, Tune's copy and
both `BAD_VALUE_NOTE` strings.

## Verification
Domain test per affected field (0, negative → issue on its .dq); `grep -rn "BAD_VALUE_NOTE\|isBadValue"
packages/ui/src` finds nothing; editor and Tune show the domain's text.
