# The notify gate cannot see a write that leaves the class through a lens

Status: RESOLVED 2026-09-09

## Symptom

`packages/ui/test/ui/architecture-notify.test.ts` — repointed at `OpenISDProject` after
`packages/ui/src/logic/managedProject.ts` was deleted — reports four public mutators whose call
graph never reaches `#notify()`:

```
these public mutators never reach #notify() through any same-class call:
  setDriver, loadDriver, solveVentGroup, solvePrGroup
```

All four are false positives, for two different reasons, and the gate reports zero true
positives. It cannot currently distinguish a mutator that notifies from one that does not.

## Example

`setDriver`/`loadDriver` DO notify — through a call that leaves the class:

```ts
setDriver(source: OpenISDDriver): void {
    this.driver.update(source);
}
```

`this.driver` returns an `OpenISDDriverEmbedded` window built over `#slot('driverEmbedding')`,
and every write through that lens runs:

```ts
set: (value) => {
    const base = this.#ensureEditing();
    this.#edited = {...base, [key]: value};
    this.#notify();
},
```

The gate's `sameClassCalleesOf` records only `this.foo(...)` / `this.#foo(...)` edges, so
`this.driver.update(...)` is a dead end by construction — the comment at that function says so
explicitly ("a call on the driver instance, not on `ManagedProject` itself, is deliberately not
an edge").

`solveVentGroup`/`solvePrGroup` are the other kind of false positive: empty QO126 stubs that
mutate nothing at all, classified as mutators only because they return `void`.

## Impact

The gate is red with four entries, none of which is a defect, so its output cannot be acted on:
a genuine non-notifying mutator appearing in that list would be indistinguishable from the noise
already there. The property it exists to guard — every public mutator notifies — is currently
unenforced.

Proof the two real methods notify, and that a test can tell:
`packages/design/test/domain.test.ts` — "notifies when setDriver replaces the whole driver
record" and "notifies when loadDriver adopts a driver from outside the project", both green.

## Fix

Two narrow changes in `packages/ui/test/ui/architecture-notify.test.ts`, neither loosening what
the gate asserts:

1. **The lens edge.** `lensGetters` collects every getter whose own body calls `this.#slot(...)`,
   read off the AST rather than hand-listed. `sameClassCalleesOf` then treats
   `this.<lensGetter>.foo(...)` as reaching `#notify()`, because `#slot()`'s setter calls it. A
   getter that stops going through `#slot` stops conferring the edge.
2. **Empty bodies are not mutators.** A void method with no statements writes nothing, so there
   is no state change for a notification to accompany. `solveVentGroup`/`solvePrGroup` are such
   stubs today (QO126); the moment either grows a body it is a mutator again.

## Verification

```
npx vitest run packages/ui/test/ui/architecture-notify.test.ts   2 passed
```

Both new arms were broken on purpose and watched go red, then restored:

| broken | reported |
|---|---|
| `get driver()` routed through `#nonLens(...)` instead of `#slot(...)` | `setDriver`, `loadDriver` |
| `solvePrGroup()` given a body that writes without notifying | `solvePrGroup` |

`packages/design/test/domain.test.ts` gained two behavioural tests proving the property
independently of the AST model — "notifies when setDriver replaces the whole driver record" and
"notifies when loadDriver adopts a driver from outside the project" (78 passed).
