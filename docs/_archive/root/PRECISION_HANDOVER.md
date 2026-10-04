# Precision Implementation Handover

## What Was Done (commit 34a8b7fa, uncommitted follow-ups)

### Commit 34a8b7fa: "Field decimals: at least WinISD's; entered values keep typed digits; calculated values show the precision their inputs support"

- **Registry minimums (field.ts):** Rms 5→5, BL 3→5, Znom 0→4, Xmax 2→3
- **Propagation rule:** First-order error propagation (∂f/∂x sum), not "most precise input"
- **Engine (DriverEngine.ts):** `calculatedWidths()` does finite-difference perturbations, passes precision to `setCalculated()`
- **Storage:** Precision on E and C entries (openisdSchema.ts)
- **Round-trip gate:** Ignores C precision since it's recomputed on load
- **Display:** `knownDecimals(halfWidth, value)` returns decimals up to the first uncertain digit
- **ARCHITECTURE.md:** Full "Precision" section explaining the rule, where it comes from, why the worst-case bound

### Tests passing:
- 1491 design+UI unit tests (all layers)
- 33 browser specs (driver-editor precision cases)
- Typecheck clean

## What's Wrong (architectural violations)

### Maths in the wrong layers:

1. **`knownDecimals()` in domain/precision.ts** — should not be domain concern; it's display logic.
2. **`shownDecimals()`, `displayPrecision()`, `statedPrecision()` in ui/logic/fields/units.ts** — UI doing maths instead of calling core.
3. **Hand-cranked decimal scaling in NumInput/NumReadout Vue** — should be `field.format()` call.

### Wrong: Engine doesn't import domain for maths, but UI does—calls into domain layer for non-domain concerns.

## New Plan (approved)

Move all display maths into `NumberField` methods in `packages/design/fields/field.ts`:
- `format(valueSI, halfWidthSI, token)` → formatted string (all decimals logic, unit conversion)
- `statedHalfWidth(typed, token)` → SI half-width of what was typed
- `toSI(typed, token)` → SI value (was `fromDisplay`)
- `minDecimalsIn(token)` → field minimum in that unit

Move `knownDecimals()` to `packages/design/fields/precision.ts` (not domain).

UI becomes display-only:
```ts
const text = computed(() => props.field.format(props.value, props.halfWidth, token.value));
```

See `/home/john/.claude/plans/shimmying-jumping-thompson.md` for the full plan.

## Undone work (will be replaced by new plan)

These changes are *currently on disk, uncommitted*:

- Switched from "most precise input" rule to "interval propagation" rule (DriverEngine.ts)
- Rewrote tests: 0.2200, 0.006, 0.0060 outcomes
- Updated ARCHITECTURE.md § Precision to explain the new rule
- Updated browser test expectations

**Do not commit these.** The new plan rebuilds the display layer differently. The core propagation rule (interval, not relative) is good and stays; the display path changes.

## Open questions that led to the new plan

1. **Where should `knownDecimals()` live?** Was in `domain`; should not depend on domain. → Move to `fields` layer.
2. **UI doing display maths:** `shownDecimals()` is called from NumInput/NumReadout; that's maths in the view layer. → Hoist to core as `NumberField.format()`.
3. **Precomputing decimals:** Can't precompute once since it depends on the selected unit. → Compute on demand in `format()`.

## To resume: next steps

1. Read the approved plan: `/home/john/.claude/plans/shimmying-jumping-thompson.md`
2. Check `architecture-*.test.ts` to confirm `fields` can be a math/utility layer and what imports are forbidden
3. Implement the core (`NumberField` methods) — start with the simplest (unit conversion + decimals)
4. Repoint UI callers to the new methods
5. Delete the old utilities from `ui/logic/fields/units.ts`
6. Commit and verify

## Files to touch

**Core (packages/design/):**
- `fields/field.ts` — add `format()`, `statedHalfWidth()`, `toSI()`, `minDecimalsIn()` methods
- `fields/precision.ts` (new) — move `knownDecimals()` from `domain/precision.ts`
- `domain/index.ts` — repoint `knownDecimals` export

**UI (packages/ui/):**
- `src/ui/components/NumReadout.vue` — one-liner `format()` call
- `src/ui/components/NumInput.vue` — use `format()` for display, `statedHalfWidth()` for commit
- `src/logic/fields/units.ts` — keep only token rotation (`nextToken`), delete maths
- `src/logic/appState.ts:808` — use `format()` instead of hand-rolled

**Tests:**
- `test/fields/field-*.test.ts` — test the new `NumberField` methods
- `test/ui/driver-editor-precision.browser.spec.ts` — update for new structure (same outcomes)

## What stays as-is

- Engine propagation rule (first-order, interval arithmetic)
- ARCHITECTURE.md explanation (already written)
- Cell `.precision` field and `setCalculated()` signature
- Round-trip gate (already handles C precision correctly)
