Status: OPEN

# The `use` prefix names four modules that are mostly not composables

## Symptom

`use` is Vue's convention for a COMPOSABLE — a function returning reactive state, called during
component setup. Four modules carry the prefix; most of what they export is neither reactive nor
setup-bound, so the name misdescribes the file and a reader cannot tell what it does from it.

## Evidence

| File | Exports | Actually a composable? |
|---|---|---|
| `packages/ui/src/logic/useDriverCells.ts` | `CellClass` (enum), `cellClassOf()`, `Q_GROUP` (const), `useQGroupIncomplete()`, `consistencyNote()` | 1 of 5 |
| `packages/ui/src/logic/useDesignIO.ts` | `createDesignIO(deps)` returning 8 methods | 0 — it is a FACTORY, and its own export is named `create*` |
| `packages/ui/src/logic/useVentGroup.ts` | `enterVentFieldOn(P, field, value, box)` etc. | 0 — plain functions over explicit arguments |
| `packages/ui/src/logic/usePrGroup.ts` | `enterPrFieldOn(P, field, value)` etc. | 0 — same |

`useDesignIO.ts` is the sharpest case: the prefix promises a composable while the module's only
export is `createDesignIO`, a factory. Two conventions in one filename, contradicting each other.

John, 2026-08-21, on being unable to tell what `useDriverCells` was: *"what even is that class"*.
Earlier, on `useDesignIO`: *"what does useDesignIO mean anyway — horrible"*.

## Cause

A framework idiom applied at module level rather than to the functions it describes. `use` names
the MECHANISM (a Vue composable) instead of the SUBJECT (what the module is for), so it carries
no information about the file's job while implying a reactivity contract most of the file does
not honour.

## Fix

Not fixed. Rename by subject, not mechanism, and reserve `use*` for functions that genuinely
return reactive state and must be called in setup:

- `useDesignIO.ts` → `createFileIO.ts` — already planned as objective 6 of
  `docs/plans/PLAN_QO60_LAYERING_REMEDIATION.md`, and matches the `createFileIO` factory name
  `ARCHITECTURE.md:517` already specifies.
- `useDriverCells.ts` — mostly dissolves: `Q_GROUP`/`useQGroupIncomplete` leave for the engine
  (`BUG_20260821_q_group_redeclared_in_ui_against_the_engines_explicit_ban.md`); what remains is
  the CSS-class mapping, which belongs with presentation state.
- `useVentGroup.ts` / `usePrGroup.ts` — plain function modules; name them for what they solve.

`useQGroupIncomplete()` itself keeps its prefix — it returns a `ComputedRef` and is the one
genuine composable in the set.

## Verification

N/A — open. Afterwards: every `use*` name in `packages/ui/src` returns reactive state.
