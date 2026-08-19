# store.ts writes `box.active` directly instead of calling `setActiveAlignment()`, the model's own documented "one legal way"

# Status
FIXED

## Symptom

`packages/model/src/openisdProject.ts:215` section header: "── Construction and the one legal
way to switch alignment ────". `setActiveAlignment(box, kind)` (`:265`) is that function — it
exists specifically so nothing outside the model reasons about switching alignments any other
way.

`packages/ui/src/logic/store.ts:300` — the `state.box` setter — does this instead:
`set: (v: BoxType) => managedProject.mutate(p => { p.box.active = toAlignmentKind(v); })`, a raw
field write that bypasses `setActiveAlignment()` entirely. `setActiveAlignment` currently has
exactly one caller anywhere in the tree: its own test, `packages/model/test/openisdBox.test.ts`.

## Cause

Not investigated — either `store.ts`'s box-active wiring (ledger QO54, "P1S4 design decision:
state.P box/vent/PR fields become accessor properties over OpenISDProject") was built before
`setActiveAlignment()` existed, or it was built without knowing about it.

## Fix

Not applied — reported per bug-first rule. `store.ts:300` should call
`managedProject.mutate(p => setActiveAlignment(p.box, toAlignmentKind(v)))` instead of writing
`p.box.active` directly, so `setActiveAlignment()`'s own invariant ("If it does anything else,
some future alignment's own state may need touching on switch" — its test's own words at
`openisdBox.test.ts:91`) actually governs every box-alignment switch, not just the one this
function is tested against.

## Verification

`store.ts:302` now calls `setActiveAlignment(p.box, toAlignmentKind(v))` instead of writing
`p.box.active` directly; `setActiveAlignment` imported from `@openisd/model`.
`npx tsc -p packages/ui --noEmit` clean (pre-existing unrelated `App.vue` module-resolution
error only). `npx vitest run packages/ui/test/logic/boxActiveSync.test.ts
packages/ui/test/logic/managedProjectBoxFields.test.ts packages/model/test/openisdBox.test.ts`
— 24/24 pass.
