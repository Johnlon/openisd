# BUG_20260927_driver-bad-value-decided-in-ui

**Status:** RESOLVED

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

## Resolution (2026-09-27)
Generalised `InvalidVolumeIssue`/`Engine.boxVolumeIssue` (the box-volume fix,
BUG_20260927_box-volume-validity-decided-in-ui.md) into field-agnostic `InvalidValueIssue`
(`kind: 'invalid-value'`) / `Engine.positiveValueIssue` — a box volume and a driver spec value
are the same fact (a positive physical quantity), so this is the SAME method for both, not a
near-duplicate. Renamed throughout: `consistency.ts` (`positiveValueIssue`, `invalidValueToText`),
`Engine.ts` (`positiveValueIssue`, `invalidValueToText`), `cell.ts`'s `issueMark` switch case,
every box file's call site (openISDBox.ts, sealedBox.ts, ventedChamberWindow.ts,
passiveRadiatorBox.ts), and both tests that pinned the old name (box-volume-validity.test.ts,
OriginalShell-hooks.test.ts).

Wired onto every driver spec field: `entryField` (`domain/cell.ts`) gained an optional `getDq`
parameter — a SECOND dq source computed fresh from the CURRENT value on every read, alongside
whichever of `issuesSource`/`liveDq` already applies, mirroring `requiredField`'s own `getDq`
the box-volume fix already uses. `OpenIsdDriverSpec`'s `f(key)` (every numeric field goes
through it — `VCCon` has its own separate construction, never through `f`) now passes
`(v) => engine.positiveValueIssue(v)`, so the mark appears immediately on `.set()`, not only
after the next `resolve()`.

Deleted: `isBadValue` and `BAD_VALUE_NOTE` (DriverEditorModal-hooks.ts), `dqNoteFor`'s
`isBadValue` special case (now a pure `.dq` render, same as any other issue), Tune's own copy of
both (OgTune-hooks.ts's `dqNote`).

## Verification (done)
New domain test `packages/design/test/domain/driver-value-validity.test.ts`: every entered
numeric spec field driven to 0/-1/NaN carries `{kind: 'invalid-value', value}` on its own `.dq`
(`toContainEqual`, since setting one field can also disturb others' own missing-dependencies
marks through the solver's normal cross-field relations — not this floor's business). Red
first: the test failed against the unfixed source (no `invalid-value` mark existed at all, 53
of 56 assertions failing) before the `entryField`/`f(key)` wiring landed, then passed after.

`grep -rn "BAD_VALUE_NOTE\|isBadValue" packages/ui/src` → nothing. `npm run typecheck` clean
(design/persistence/ui). Full suites: packages/design 2278 tests, packages/ui 581 tests, both
passing.
