---
paths:
  - "packages/**/*.ts"
  - "packages/**/*.vue"
---

# TypeScript

## No global variables

No module-scoped mutable state: no `let`/`var` at module scope, no singleton holding
application state, no module-level `Map`/`Set`/array/object anything writes into, no registry
written at import time. Pass dependencies in as constructor or function arguments; the
application's composition root decides what exists.

**Exception — friend side-table.** A module-scoped `WeakMap` giving sibling classes in the same
module the access TS has no `friend` keyword for. Qualifies only if all hold:

1. keyed by object identity (`WeakMap`, never `Map`);
2. never exported, and no exported function returns it;
3. every entry per-instance;
4. it expresses privacy, not application state.

Each use carries a comment at its declaration naming whose internals it exposes and to which
sibling. Current uses: `packages/design/domain/project.ts` — `projectRecords`, `owningManaged`,
`projectListeners`, `jsonReaders`.

## Closed sets are enums

Java-style classes, not TS `enum`. Reference shape: `DriverType`, `Chip` in
`packages/ui/src/driverType.ts`.

- `.value` — the serialised form and the only thing that crosses a boundary (wire string,
  `localStorage`, the Vue reactive store). Store `.value`, never the member: a member in a `ref`
  is proxied and loses `===` identity.
- `.display`/`.label`/`.title`/`.chips` — on the member, never in a side map.
- `static parse()` — the only string→member boundary. An undeclared value is invalid data.
- `static ALL` — built by reflection, declared **last** (static fields initialise in source
  order).

Gates: `packages/ui/test/driver-type-chips.test.ts`, and winisd_tools'
`scrapers/tests/test_driver_type_enum_parity.py` which reads `driverType.ts` directly — changing
that file's shape means changing that test in the same commit.

## Encapsulation

A layer never touches another layer's private shape — not directly, and not through a type alias,
a widened type (`unknown`, `any`, `object`), a structural clone, a getter returning the private
object, or a transient hold. The test is what the value IS, not what the type is called. The
remedy is a method on the owning object answering the caller's question in the caller's
vocabulary.
