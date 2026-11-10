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
Reference: `DriverType`/`Chip` in `packages/design/filter/driverType.ts`.

**Encapsulation.** A layer never touches another layer's private shape — not via a type alias,
`unknown`/`any`/`object`, a structural clone, a getter returning the private object, or a
transient hold. Fix: a method on the owning object, answering in the caller's vocabulary.

**No inline object types.** No inline object-literal type on a parameter/return/variable/generic
(`(p: { brand: string })`), no `Record<string, T>` or index signature standing in for known
fields, no "whatever has these fields" interface at a boundary. Declare `interface Foo { ... }`
and use it by name.

## No default or optional parameters (John, 10 Nov 2026)

- No default parameter values (`x = something`) and no optional parameters (`x?`) in a function or constructor. Every caller passes every argument. John: "avoid default args as they lead to bugs and are not transparent"; "an optional Param can be a default in disguise".
- Context that differs by caller (project vs app, air, Cms source) is a required, branded type: `ProjectContext` / `AppContext`, never a default.
- Where "not given" means something, the caller writes it out: `null`, or a named case (`NoVersions`), so each call shows what it means.
- Tests never lean on a production default: a test builds what it needs from one named test helper (`testAppServices()`, `testAnnouncementEndpoints()`).
- Why: the driver editor's copy of a project driver got "no project" and the app's air from two defaults; it compiled and showed a wrong Cms note. The announcements service defaulted to the test server.
- Checked by `packages/design/test/architecture-no-default-parameters.test.ts`: the count only goes down, to 0. Policy: docs/SDLC_POLICY.md rule 6. Review of every one: docs/research/DEFAULT_PARAMETERS_REVIEW.md.
