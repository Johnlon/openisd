---
paths:
  - "packages/**/*.ts"
  - "packages/**/*.vue"
---

# TypeScript — concrete types

**No globals.** No module-scope mutable state (`let`/`var`, singleton, module-level
`Map`/`Set`/registry). Pass dependencies as constructor/function arguments; a composition root
wires the concrete graph.

**Closed sets are enums.** Java-style classes, not TS `enum`. `.value` is the only thing that
crosses a boundary (wire string, storage, reactive store) — never the member itself. `static
parse()` is the only string→member boundary. `static ALL` is built by reflection, declared last.
Reference: `DriverType`/`Chip` in `packages/ui/src/driverType.ts`.

**Encapsulation.** A layer never touches another layer's private shape — not via a type alias,
`unknown`/`any`/`object`, a structural clone, a getter returning the private object, or a
transient hold. Fix: a method on the owning object, answering in the caller's vocabulary.

**No inline object types.** No inline object-literal type on a parameter/return/variable/generic
(`(p: { brand: string })`), no `Record<string, T>` or index signature standing in for known
fields, no "whatever has these fields" interface at a boundary. Declare `interface Foo { ... }`
and use it by name.
