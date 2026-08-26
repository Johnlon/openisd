# BUG_20260825 — no bundle-time or driver-selector validation for a record missing both T/S sections

Status: OPEN — not yet fixed. Found while designing `packages/design/domain`'s `OpenISDDriver`.

## Symptom

A driver record with neither a `woofer` nor a `tweeter` section (malformed, or a passive-radiator
record mistakenly offered as a driver) has no upstream guard today. The only place that refuses
it is `OpenISDDriver`'s own construction (real code: `packages/model/src/openisdDriver.ts`;
design-package precedent: `packages/design/domain/project.ts`'s `OpenISDDriver.window()`), which
throws. That's a last-resort assertion, not the intended defense — by the time construction is
even attempted, a bad record should already have been excluded.

## Two real gaps

1. **Bundle time.** Whatever tooling packages driver records into the app's bundled collection
   should reject a record missing both T/S sections before it ships, so a broken record never
   reaches the runtime at all. Not yet checked whether this validation exists anywhere in the
   bundling pipeline.
2. **My Drivers / driver selector UI.** A saved or fetched record with bad/incomplete data
   should show a DQ flag in the picker and be unselectable — a user should never be able to
   choose a driver that can't construct. Not yet checked whether `DriverBrowserWinisd.vue`/
   `DriverEditorModal.vue` or the My Drivers repo layer does this today.

## Scope of the fix

Not yet executed — needs investigation of the real bundling scripts and the driver-selector
components before a fix can be scoped; this record exists to not lose the finding, not to
propose an implementation yet.

## Origin

Found 2026-08-25 while designing `OpenISDDriver.window()`'s construction-time refusal in
`packages/design/domain/project.ts`.
