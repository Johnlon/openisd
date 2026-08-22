# A9 gate drafts — held out of the tree

Two of A9's three architecture gates, authored and demonstrated. The third,
`architecture-no-reexports.test.ts`, is already in the suite.

| draft | invariant |
|---|---|
| `import-from-declarer-only.test.ts.draft` | every import names the module that DECLARES the symbol, never a re-exporter |
| `no-domain-value-through-component.test.ts.draft` | no `.vue` prop or emit carries a type declared in `packages/model` |

## Landing condition

Land after A8, once sonnet1's D20 rename has settled. Drop the `.draft` suffix and place both in
`packages/ui/test/ui/`, beside `architecture-no-reexports.test.ts`.

Neither gate hardcodes a path that D20 moves. Both discover their scope by walking
`packages/*/src` and resolving through the type system, so `persistence/storage/`,
`persistence/repos/`, `logic/appState.ts` and `logic/driverBrowsingState.ts` are covered the
moment they exist, under whatever names they land with. Writing the post-D20 paths into the
gates would couple them to a layout that is still moving and buy nothing a directory walk does
not already give.

## Both gates are green on the tree as it stands

Measured 2026-08-22 18:4x BST at `48b3d0b` plus sonnet1's in-flight edits:

- gate 1: 0 offences across every `.ts` and `.vue` under `packages/*/src`
- gate 2: 0 offences across 21 components

Neither is born red, so landing them blocks nothing.

## Each gate proves it can fail

A green gate is worth nothing until it has been seen to go red, so the failure cases ship inside
the test files as `it()` blocks over synthetic in-memory sources — no fixture files, no reliance
on a violation existing in the tree.

Gate 1 flags an import served by a re-exporter, passes the same import taken from the declaring
module, and passes it again when the intermediary is a sanctioned package entry point.

Gate 2 flags a domain type on a prop through three separate indirections — direct, via a local
`type Row = OpenISDDriver` alias inside an array, and through a union with `null` — flags a
domain type inside an emit payload tuple, flags a `defineProps` written in the runtime-object
form that carries no type argument to inspect, and passes a component whose API is primitives
and callbacks.

Gate 2's real-project resolution was verified separately by parsing a synthetic component
against the live `tsconfig.json` (never written to disk): `driver: OpenISDDriver` imported from
the `@openisd/model` barrel resolved to `packages/model/src/openisdDriver.ts`, as did an emit
payload of the same type. The tree scan is therefore genuinely empty rather than blind.

## Exemptions

Gate 2's `EXEMPT_COMPONENTS` is empty and is meant to stay empty. A component that genuinely
needs a domain object is a design question, so it is reported and ruled on rather than absorbed
by a new row.

Gate 1's exemption is not a list. It reads each package's own `package.json` exports map and
treats every subpath it publishes as an entry point, so it follows an entry-point rename instead
of pointing at a filename that may no longer exist.
