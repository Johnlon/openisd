# Vent cross-sectional area (`π·(ventD/2)²`) is computed inline in 4 places, no single engine formula

# Status
RESOLVED — `ventArea_m2()` (`packages/model/src/openisdProject.ts:321`) is the single source;
`wprMapping.ts`, `OriginalShell.vue`, `useVentGroup.ts` and `store.ts` all call
`managedProject.ventArea_m2()` (or the model function directly).
`grep -rn "Math.PI \* (.*ventD" packages/ui/src` returns nothing.

## Symptom

`Sp = π·(ventD/2)²` (round-vent cross-sectional area from diameter) is written as inline
`Math.PI * (ventD / 2) ** 2` arithmetic in four separate files, with no shared engine function
either any of them calls. `wprMapping.ts`'s own header comment claims *"Pure glue only — every
box-tuning value comes from an EXISTING engine formula... no physics is re-derived here"* — this
one line violates that claim inside the same file that states it.

## Evidence

```
packages/ui/src/logic/wprMapping.ts:42:              const Sp = Math.PI * (P.ventD / 2) ** 2;
packages/ui/src/ui/shells/original/OriginalShell.vue:147:  return Math.PI * (state.P.ventD / 2) ** 2;
packages/ui/src/logic/useVentGroup.ts:49:            return Math.PI * (ventD / 2) ** 2;
packages/ui/src/logic/store.ts:383:              p.Sp   = Math.PI * (state.P.ventD / 2) ** 2;
```
`grep -rn "function.*ventArea\|ventArea\b" packages/engine/src` finds nothing — no canonical
`ventArea()`/equivalent exists in `@openisd/engine`.

## Cause

Same pattern as `BUG_20260817_wdr_writer_computes_ebp_itself_violating_its_own_no-calc-logic_rule.md`
— a simple formula got reimplemented at each call site as it was needed, instead of being
written once in the engine and called from everywhere else. Four independent copies means four
places that could silently drift if the formula (or the round-vent-only assumption) ever needs
correcting.

## Fix

Not applied — reported per bug-first rule. Add `ventArea(ventD: number): number` (or similarly
named) to `@openisd/engine`, and repoint all four call sites at it. Per the human ruling on
`REVIEW.md`'s `CircuitSolverParams`/`buildWprInput` rewrite (2026-08-18): this and similar
box/vent-derived calcs should become properties/methods on `ManagedOpenISDProject`'s own API
(or the API of whatever it composes), not free-standing inline arithmetic duplicated at every
consumer — so the actual fix here should land as part of that broader rewrite, not a standalone
patch that keeps four call sites independently calling a shared function.

## Verification

Fixed, per the ruling's actual shape (a getter on `ManagedOpenISDProject`, not a bare
`@openisd/engine` function): `ventArea_m2()` lives once in
`packages/model/src/openisdProject.ts:321`, and all four former call sites now read
`managedProject.ventArea_m2()` (`wprMapping.ts`, `OriginalShell.vue`, `store.ts`) or the model
function directly (`useVentGroup.ts`). `grep -rn "Math.PI \* (.*ventD" packages/ui/src` returns
nothing.
