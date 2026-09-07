# packages/design — AGENTS

## Build exactly the specified shape

Build the shape John named, and only that. Every member, behaviour change or convenience you
add must trace to something he asked for; if it does not, drop it.

A behaviour change counts as part of the shape: keep a method that threw still throwing, keep
an input's accepted range as it was, add no fallback — unless John asked for the change, even
in a file you were told to edit.

When the specified shape leaves a genuine gap, say so and stop for John's decision. Leave the
gap open rather than fill it and explain afterwards.

## Shared mutable state at module scope is prohibited

No module-scoped binding may vary after the module loads. Banned: a top-level `let`/`var`, a
bare object/array literal or `new X()` that nothing freezes, a registry, singleton or cache —
and, regardless of how it was declared, any module-scoped binding that something later writes
to (an assignment, or a mutating call like `push`/`set`/`delete`/`add`).

Anything that varies at runtime lives on an object a caller holds, passed in and returned —
never at module scope. When a module-level `let`, `Map`, `Set`, registry, singleton or cache
looks necessary, the design is wrong: say so and stop.

A module-scoped `const` is a different thing and is not banned by this rule. It is fine on its
own merits, with no approval needed, once it is genuinely immutable:

- `Object.freeze({...})` / `Object.freeze([...])` for a lookup table (it may be indexed by a
  runtime key — indexing is not the problem, mutability is);
- `{...} as const` / `[...] as const` for a readonly literal;
- a primitive, an arrow function, or a call returning neither a container nor a `new`.

`test/architecture-no-globals.test.ts` enforces this by checking mutability directly (AST-level:
is the binding reassignable, is its initializer an unfrozen container, is it written to anywhere
in the file) — there is no separate name-by-name allowlist to maintain.

## Preserve type information so casts stay unnecessary

Model values precisely enough that the compiler already knows what you know: narrow with type
guards, prove completeness with `Exclude<>`, check shapes with `satisfies`. Keep the specific
type flowing through — assigning to a wider or keyless type (`unknown`, `any`,
`Record<string, unknown>`) throws away the information a later cast would have to reassert.

When a cast still looks needed, bring three things to John and let him decide:

1. what the cast asserts — the exact claim about the value;
2. why the compiler cannot prove it — why a guard, `satisfies` or a completeness proof does
   not reach;
3. what preserving the type honestly would cost.

An approved cast stays. `as const` and `satisfies` are not casts.
`test/architecture-no-casts.test.ts` enforces this; a red result is a list to take to John.

## Expose only the class surface from `domain/index.ts`

`domain/index.ts` — the package's public surface — exports `OpenISDDriver`, `OpenISDProject`
and the other class/interface types. Consumers outside `domain/` get those and only those.

The JSON record types (`OpenISDDeviceJson`, `OpenISDBoxJson`, `OpenISDProjectJson`,
`ChamberJson`, `VentJson`, `OpenISDEnvironmentJson`, `SpecEntryJson`, `Reading`, `DqMark`, …)
stay inside `packages/design/domain/`. They carry `export` so files in that folder import
them from each other; `domain/index.ts` re-exports none of them — not the type, not a value,
not a `Pick<>`/`Omit<>` or a structural alias carrying the same shape under another name.

The test is what `domain/index.ts` exports, not where a type is declared. The architecture
test that checks that export list enforces it — add one if none does.
