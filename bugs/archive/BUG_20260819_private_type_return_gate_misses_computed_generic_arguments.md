# The "returns a private _Name" arch gate misses a `computed<T>()` call's generic type argument

# Status
RESOLVED — `store.ts:415` now declares `export const driverRecord: ComputedRef<DriverJSON |
undefined> = computed(...)`: an explicit type annotation (closing the gate gap) naming the
public `DriverJSON` shape, not the private `_OpenISDDriverJson` (closing the leak itself).

## Symptom

`store.ts:445` — `export const driverRecord = computed<_OpenISDDriverJson | undefined>(() =>
_projectToPersist().driver);` — hands the private `_OpenISDDriverJson` shape to every importer
(`driverSelection.ts`, `useApplicationIO.ts`, `OriginalShell.vue`) without any of them writing the
type name themselves. This is precisely what `architecture.test.ts`'s `'an export typed as a
private _Name must itself be _-prefixed'` gate exists to catch (QO58) — but it does not fire for
`driverRecord`.

## Cause

The gate's variable-statement check (`architecture.test.ts`, `for (const vs of
source.getVariableStatements())`) reads `decl.getTypeNode()` — the explicit `: Type` annotation
on the declaration itself (`const x: Type = ...`). `driverRecord`'s declaration has no such
annotation; the type only exists as `computed<_OpenISDDriverJson | undefined>`'s generic
argument, attached to the CALL EXPRESSION, not to the variable declaration. `decl.getTypeNode()`
returns `undefined` for it, so the check's `if (!tn) continue;` skips the whole declaration
before `typeNodeNames()` — which DOES walk generic type arguments — ever runs on it.

## Fix

Not applied — reported per bug-first rule. Give the declaration itself an explicit type
annotation (`const driverRecord: ComputedRef<_OpenISDDriverJson | undefined> = computed(() =>
...)`) so `decl.getTypeNode()` returns the `ComputedRef<...>` reference, whose generic argument
`typeNodeNames()` already walks structurally. This makes the existing, real leak (QO58) visible
to the gate rather than fixing the leak itself — QO58 still needs a human decision (add
`driverSelection.ts`/`useApplicationIO.ts`/`OriginalShell.vue` to `_OpenISDDriverJsonPrivateAllow`,
which is human-edit-only, or give the io boundary a public type).

## Verification

The specific leak is closed, not merely made gate-visible: `store.ts:415` now reads
`driverRecord: ComputedRef<DriverJSON | undefined>` — a public type, so nothing leaks. The
gate's general mechanism gap is NOT closed: `architecture.test.ts:761` still reads only
`decl.getTypeNode()` and does not walk a `computed<T>()`/`ref<T>()` call expression's generic
argument. Two other unannotated instances remain in the tree
(`packages/ui/src/logic/driverLibrary.ts:125,240` — `ref<_OpenISDDriverJson[]>`,
`computed<_OpenISDDriverJson[]>`), currently invisible to this gate, though neither is an
`export const` so the variable-statement check would not reach them even if it walked generics
— out of this specific bug's scope, not re-investigated here.
