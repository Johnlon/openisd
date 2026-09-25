# The provenance gate parses a deleted engine file, so it cannot check the panel against the solver

Status: RESOLVED

## Symptom

`packages/ui/test/logic/provenance-matches-engine.test.ts` fails both its tests before reaching
any assertion:

```
→ File not found: /home/john/work/winisd/openisd/packages/design/engine/driver.ts
 ❯ engineRoutes test/logic/provenance-matches-engine.test.ts:71:26
```

## Evidence

```ts
const DRIVER_TS = join(UI_PKG, '..', 'design', 'engine', 'driver.ts');
...
const source = project.addSourceFileAtPath(DRIVER_TS);
```

`packages/design/engine/` holds no `driver.ts`. The `setVal(...)` calls the gate reads — the
solver's derivation routes — are in `packages/design/engine/solver.ts`.

## Cause

The engine's solver was moved into `solver.ts` during the `packages/model` → `packages/design`
migration and this path was not updated with it. The gate's whole purpose is to read the
engine's real routes out of the AST rather than trust a copied list, so pointing at a missing
file removes exactly the check it exists to perform.

A second defect surfaced once the gate could read a file at all: the engine names its
quantities with unit suffixes (`Fs_hz`, `Mms_kg`, `Cms_m_per_N`) while the provenance panel
names them as the record does (`Fs`, `Mms`, `Cms`). The AST walk keyed routes by the engine's
spelling, so `engineRoutes().get('Fs')` returned nothing and the comparison ran against an empty
list.

## Fix

- `DRIVER_TS` repointed at `packages/design/engine/solver.ts`, and the comments naming
  `driver.ts` corrected to name `solver.ts`.
- The AST walk strips the unit suffix from each quantity name, so routes are keyed the way the
  panel names its fields and the two sides are actually comparable.

## Verification

`npx vitest run packages/ui/test/logic/provenance-matches-engine.test.ts` — watched failing with
"File not found", then passing, with the gate's own "only N derived fields found — the AST read
is broken" guard confirming it is genuinely reading routes rather than finding an empty file.
