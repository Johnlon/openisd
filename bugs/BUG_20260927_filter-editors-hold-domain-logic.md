# BUG_20260927_filter-editors-hold-domain-logic

**Status:** OPEN

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
- Subtype options into `packages/design/fields/options.ts`, next to `FILTER_TYPE_OPTIONS`.
- A typed core update per filter class (e.g. `filterModel(f).with({order})` or a per-type
  `update` that validates, rounds order and clamps to WinISD's limits) returning the next `Filter`
  or a reason; editors only call it.

## Verification
Editors import no option lists or numeric rules; unit tests on the core update; the filters-tab
browser spec unchanged.
