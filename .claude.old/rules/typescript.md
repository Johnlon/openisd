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

## No inline object types in new code

An object type is declared once, by name, and used by name. In new code, never:

- an inline object-literal type on a parameter, return, variable, generic constraint or
  type argument: `(p: { brand: string; model: string })`, `(): { rows: Row[] }`,
  `Row extends { uuid: string }`, `Map<string, { at: number }>`;
- `Record<string, T>` or an index signature standing in for a known set of fields;
- a "whatever has these fields" interface at a boundary (`NameableDevice`).

Declare `interface DeviceFixture { readonly brand: string; … }` — or a class where the
surrounding code uses classes — and name it. A row type extends its base by name
(`interface BundledDriverIndexRow extends BundledIndexRow`); a generic is constrained to the
named base. Existing inline types are replaced when the code around them is touched, not hunted.

John, 2026-09-14: "I REALLY HATE STRUCTURAL TYPES". Structural types make the concepts in the
code hard to follow, at both ends: at the usage, an inline shape says only which fields happened
to be needed here, not what the thing is, so the reader cannot tell a fixture from a record from
a row; at the implementation, there is no name to search for, no declaration to read, and no way
to find every place the concept is used — the same shape is retyped at each site and drifts. A
named type is the concept: one declaration to read, one name to grep, one place it changes.

