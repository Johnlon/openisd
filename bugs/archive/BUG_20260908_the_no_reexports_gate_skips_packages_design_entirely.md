# The no-re-exports gate skips packages/design entirely, so its whole surface is unchecked

Status: RESOLVED

## Symptom

`packages/ui/test/ui/architecture-no-reexports.test.ts` reports no subpath barrels at all,
though `packages/design` declares five:

```
→ no subpath barrels found — this guard would pass vacuously
```

and its positive control cannot find the barrel it names:

```
→ precondition: the model barrel is a sanctioned barrel
```

## Evidence

Barrel discovery starts from a `src` directory that must exist:

```ts
const SRC_ROOTS = readdirSync(PACKAGES)
  .map(pkg => join(PACKAGES, pkg, 'src'))
  .filter(dir => existsSync(dir) && statSync(dir).isDirectory());
```

`packages/design` has no `src/` — its code sits in `domain/`, `engine/`, `winisd/`, `filter/`,
`browser/` and `ini/`, and its `package.json` maps exports to those directories directly:

```json
".":        { "default": "./domain/index.ts" },
"./engine": { "default": "./engine/index.ts" },
"./winisd": { "default": "./winisd/index.ts" },
```

So `SRC_ROOTS` contains `packages/persistence/src` and `packages/ui/src` and nothing else, and
every file in `packages/design` — the largest package and the one under active migration — is
outside the sweep. A re-export added anywhere in it would not be reported.

The positive control names `packages/model/src/index.ts`, deleted with `packages/model`, so both
control tests fail before checking anything.

## Cause

The gate was written when every package kept its code under `src/`. `packages/design` does not,
and the discovery step silently yields nothing for a package shaped differently rather than
failing. A gate that finds no files reports no offences, which reads exactly like a pass.

## Fix

Discovery is driven by each `package.json`'s own `exports` map — which is already how BARRELS
resolves the sanctioned entry points — instead of assuming a `src/` directory. The scanned roots
become the directories those entry points live in, so a package is covered whatever its layout.

The positive control moves to `packages/design/domain/index.ts`, a sanctioned root barrel that
genuinely re-exports, replacing the deleted model barrel.

## Verification

`npx vitest run packages/ui/test/ui/architecture-no-reexports.test.ts` — 3/3 green, with the
subpath guard now finding design's five subpath barrels rather than passing vacuously.

Made to fail on purpose: adding `export type { Engine } from './engine/Engine.js';` to a
non-barrel file in `packages/design` — watched the sweep report it, then removed. This is the
case the gate could not see before.
