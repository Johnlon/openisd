# PR formulas are free functions, not getters on a domain class

## Status
OPEN — awaiting a human ruling. The ruling asked for a getter; what exists is a free function.

## Symptom

The passive-radiator T/S formulas are confined to the engine and called from one place outside it,
which satisfies containment. They are not reachable as getters on a domain class, which the
ruling asked for.

`packages/model/src/openisdProject.ts:472-478` declares `prCmsFromWinIsdVas`, `prMmdFromWinIsdFs`
and `prRmsFromWinIsdQms` as plain exported functions. `packages/ui/src/logic/prWinIsdFields.ts:16`
imports and calls them directly.

The ruling's words: the formulas must be *"reachable ONLY as a getter on the relevant domain
class... never called directly as a free function sprinkled through UI logic"*, and it named the
insufficient shape explicitly — *"deduplicating into a shared engine function that's then still
called ad hoc from prWinIsdFields.ts... would not satisfy this"*. The current shape is that one,
with the free function moved one package over.

## What is satisfied

The math itself lives in `@openisd/engine/src/formulas.ts` and nowhere else.
`grep -n "Math.sqrt\|Math.PI" packages/ui/src/logic/prWinIsdFields.ts` returns nothing, and
`grep -n "1.20095\|343.68" packages/ui/src/logic/useDesignIO.ts` returns nothing, so the
duplicated copies and the truncated `RHO`/`C` literals are gone.

## Why the getter form was not built

`PREditModal` and `PRDefineModal` edit a plain `UiParams` object, not an `OpenISDProject`
instance. There is no live domain-class instance in this call path to hang a getter off, so the
getter form requires restructuring PR editing itself.

## The ruling needed

Either accept containment plus a single call site as the resolution, or require the
restructuring that gives PR editing a domain instance to call getters on.

## Verification

Whichever way it is ruled: no PR formula is reachable except by the sanctioned route, held by a
test that names that route.
