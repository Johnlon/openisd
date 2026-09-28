# BUG_20260927_filter-editors-hold-domain-logic

**Status:** RESOLVED

## Symptom
The Filters tab's per-type editors decide things the core should decide, so a second UI skin
would have to copy them or disagree. Rule (John, via the mobile-skin session 2026-09-27): nothing
but display lives outside packages/design.

## Evidence
- `packages/ui/src/ui/shells/original/filters/PassFilterEditor.vue`: `PASS_FAMILY_OPTIONS` (WinISD's
  subtype list, order and wording) is defined in the component.
- `packages/ui/src/ui/shells/original/filters/numericInput.ts`: `intFrom` rounds the order to an
  integer in the UI.
- Every `*Editor.vue` builds the next `Filter` value itself (`{...f, fc: numFrom($event)}`), with no
  core validation of the new value.

## Cause
Chunk 2 of the filter work (b5fe226e, refactored in 7b990eba) put these in the UI layer.

## Fix
- Subtype options moved to `packages/design/fields/options.ts`'s `PASS_FAMILY_OPTIONS`, next to
  `FILTER_TYPE_OPTIONS` — same wording and order. `PassFilterEditor.vue` reaches it through a new
  `passFamilyOptions()` in `uiFields.ts` (the layering gate: a component names no
  `@openisd/design/fields` value, only `driverDraft.ts`'s `wiringOptions()` seam).
- The filter limits (order 1..10, fc 1..20000, Q 0.1..100, gain -60..60, t 0..10, bw 0.01..10)
  moved to `packages/design/fields/filterLimits.ts` — the one source of truth. `uiFields.ts` now
  reads them instead of carrying its own literal min/max.
- Each filter class in `packages/design/engine/filters/` gained a `static with(f, patch)`:
  order rounds to the nearest integer then clamps to 1..10 (2.6 → 3; 0 → 1, the floor), every
  other numeric field clamps to its own entry range, everything else in `patch` (and every field
  left out of it) passes through unchanged. Reached through 8 new typed `Engine.updateXFilter`
  methods (one per filter class) — the engine's one door, no string-keyed dispatch.
- Every `*Editor.vue` now takes an `api: OriginalFiltersAPI` prop and calls the matching
  `api.updateXFilter(f, {field: value})`, then emits the result — it reads the DOM value
  (`numFrom`) and nothing else. `numericInput.ts`'s `intFrom` (order rounding) is deleted.

## Verification
- `packages/design/test/engine/filter-update.test.ts` (23 tests, new): order 2.6→3, order 0→1,
  out-of-range fields clamped, untouched fields preserved, variant preserved — one per filter
  class.
- `npm run typecheck`: clean (design, persistence, ui).
- `npx vitest run packages/design`: 93 files / 2178 tests pass.
- `npx vitest run packages/ui --project ui`: 77 files / 579 tests pass, including
  `OriginalFilters-hooks.test.ts` and the architecture layering gate (`architecture.test.ts`) unchanged.
- `filters-tab.browser.spec.ts` (11 tests) and `original-skin.browser.spec.ts` (54 tests): pass
  unchanged.
