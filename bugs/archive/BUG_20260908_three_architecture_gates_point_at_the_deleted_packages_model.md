# Three architecture gates point at the deleted packages/model, so two pass vacuously

Status: RESOLVED

## Symptom

`packages/ui/test/ui/no-domain-value-through-component.test.ts` passes 5/5 while its notion of a
"domain file" can never match anything:

```ts
const DOMAIN_ROOT = join(PACKAGES, 'model', 'src');
...
const isDomainFile = (p: string) => p.startsWith(DOMAIN_ROOT + '/');
```

`packages/model` was deleted. `isDomainFile` returns false for every path, so the check "no
component in the tree takes or emits a domain value" reports no offences whatever the components
do.

`packages/ui/test/ui/architecture-project-symmetry.test.ts` fails outright on the same cause:

```
const OPENISD_PROJECT_TS = join(REPO_ROOT, 'packages', 'model', 'src', 'openisdProject.ts');
```

and `packages/ui/test/ui/architecture.test.ts` carries the same dead root, plus a second one
for the also-deleted `packages/winisd`:

```ts
const MODEL_SRC = join(UI_SRC, '..', '..', 'model', 'src');
const WINISD_SRC = join(UI_SRC, '..', '..', 'winisd', 'src');
```

Both feed the file list every layering rule in that file scans:

```ts
const ALL_SRC_FILES = [...filesUnder(UI_SRC), ...filesUnder(MODEL_SRC), ...filesUnder(WINISD_SRC), ...];
```

`filesUnder` on a missing directory yields nothing, so the domain and the WinISD converters are
entirely outside every layering check in `architecture.test.ts`, and `layerOf` can never return
`'model'` or `'winisd'` for any file.

## Evidence

`packages/model/` does not exist; the domain now lives in `packages/design/domain/`, and
`OpenISDProject` is declared in `packages/design/domain/openisdDomain.ts`.

The vacuous pass is the dangerous one: a green result from a gate that cannot fail is worse than
a red, because it is read as evidence the property holds.

## Cause

The `packages/model` → `packages/design` migration moved the code and did not move the paths
these gates scan. Nothing failed at the time for the two that pass, because a gate finding no
files reports no offences — indistinguishable from a clean tree.

## Fix

- `no-domain-value-through-component.test.ts`: `DOMAIN_ROOT` → `packages/design/domain`.
- `architecture-project-symmetry.test.ts`: `OPENISD_PROJECT_TS` →
  `packages/design/domain/openisdDomain.ts`.
- `architecture.test.ts`: `MODEL_SRC` → `packages/design/domain`.

## Verification

`npx vitest run packages/ui/test/ui/no-domain-value-through-component.test.ts` — after
repointing, made to fail on purpose by giving a component a prop typed `OpenISDDriver`, watched
the gate name that component, then reverted. Before the fix the same injected prop was NOT
reported, which is the proof it was blind.
