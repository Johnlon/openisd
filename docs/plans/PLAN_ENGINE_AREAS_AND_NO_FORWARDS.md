# Engine forwarding: cleanup and the gates that keep it clean

## Context

John (2026-09-28): the hook borrowing `Engine['updatePassFilter']` and binding eight engine
methods, `Engine.updatePassFilter` forwarding to `filters.ts`, and that forwarding to
`PassFilter.with` — three layers doing nothing, one type under three names — is AI rot. Wants
it cleaned up once and something mechanical that stops it coming back.

Root cause: the one-door gate (`packages/design/test/architecture-engine-boundary.test.ts`)
says the door exports `Engine` and its types, nothing else. Every capability anyone needs
therefore has to be a method on `Engine` — 62 methods, 49 of them one-line forwards.

What John meant by "engine as a component" (2026-09-28): the engine is the *package* —
`@openisd/design/engine`, the calculations aggregated for reuse and for publishing on their
own — not literally one class. Its unit of reuse is a cohesive area of interest (filters,
vents, passive radiators, sealed alignment, …), each an interface with one implementation. The
package keeps one door; the door hands out those areas.

## Rulings (John, 2026-09-28)

1. Injection is not wrapping. A method that adds value is not a wrapper; a literal forward is,
   except a hook member that exists only because a `.vue` may hold no logic. Hooks are
   interfaces implemented by logic classes; a logic class is constructed with the app's engine
   and its other collaborators. `Engine` becomes an interface; the only implementation is a
   private class inside `packages/design/engine`, built by a factory called once from main.
2. One name per type, used everywhere.
3. Re-exporting is an evil; lint it, don't just test it.
4. No threading of `engine` through parameters; no reaching into another object's engine.
   Cohesive components, each holding the shared engine.
5. Composition in one place.
6. Better tests.
7. A free function that reads or writes an object of ours is a method that object is missing
   (`getFoo(engine, someOther)` → `someOther.foo()`).

## Status (2026-09-29)

| Step | State |
|---|---|
| A. `Engine` interface + private impl + `createEngine` | done, ea6a7dad; gate holds "no method on the aggregate" |
| B. Eleven areas, 0 forwards in `Engine.ts` | done (f92ba6ad … ff377af5) |
| C. One name per filter variant | done |
| E. Filters hook | done, 426aefa0 |
| H. Field behaviour on the field | done, d6855b11: `Readable.provenance`, `OpenIsdDriverSpec.solverParams()`, `OpenISDDriver.chartBlockingReasons()` |
| D. Components instead of a threaded engine | converters as classes (bf5062fc), project windows take one area (2209bcae), hooks take areas (51a126ed, 13f672a6), series takes `ChartEngineAreas` (22ce4efa), passive radiators and their repos carry no engine (7fd40adc), DesignFiles/DriverDrafts classes + UI gate: only main.ts imports appState's engine (686eea62 … 31acd78b). Ratchet 41 → 14 |
| F. Lint rules | not started |

Ratchet rows left (14): `OpenISDProject`/`OpenISDDriver`/`OpenISDDriverStandalone`/
`OpenISDDriverEmbedded` static factories (`empty`, `wrap*`, `from*`, `builder`) — constructors in
effect, each hands the engine to a private constructor — plus `OpenISDBox.wrap` (the box uses six
areas). Whether a static factory counts as a constructor for the gate is a human ruling.

Publishing rule settled on the way: an area method is a body; a pure function every solver shares
is published by the area unchanged as a readonly property (`readonly ebp = ebp`), never wrapped.

## Work

### A. `Engine` is an interface; one private implementation; one factory

`packages/design/engine/Engine.ts` → `export interface Engine { … }` holding only what
depends on settings: air/environment, sweep, maxCurves, the solvers, `ebp`, `isPhysicallyPlausible`
and the rest that read `this.settings`. `class EngineImpl implements Engine` is not exported
from the door. `export function createEngine(settings?: EngineSettings): Engine`.

The "once": enforced by gate, not a runtime flag — a `let created` is module state the
no-globals gate rightly rejects, and tests build engines freely. Gate: `createEngine(` appears
only in `packages/ui/src/logic/appState.ts` (the composition root) and under `test/`.

Callers: `new Engine(` → `createEngine(` (two in source: `appState.ts:150`, and
`winIsdDriverConverter.ts:750` which stops constructing one — see D). Tests likewise.

### B. The engine package publishes cohesive areas — `FilterEngine`, `VentEngine`, …

One door still: `index.ts` exports each area's interface (`FilterEngine`, `VentEngine`,
`PrEngine`, …), the types, and `createEngine(settings)`. The 62-method `Engine` class goes.
`createEngine` returns `Engine` — now only an aggregate `{ environment, driver, sealed, vented,
vent, pr, filters, signal, simulation, issues, box }` of the areas, built once for the
composition root's convenience and sharing one settings/air. A consumer depends on the one
area's interface it uses (`constructor(private readonly filters: FilterEngine)`), never on the
aggregate. Callers write `filters.caption(f)`, `vent.length(...)`.

Grouping of today's 62 (by what they are about, from `Engine.ts`):

| Member | Today's methods |
|---|---|
| `engine.environment` | `solveEnvironment`, `envDefaults` |
| `engine.driver` | `solveDriver`, `ebp`, `ebpSuitability`, `referenceEfficiency`, `splFromEfficiency`, `sourceLoadedQts`, `isPhysicallyPlausible`, `findImpedancePeak` |
| `engine.sealed` | `solveSealedAlignment`, `sealedResonance`, `sealedResonanceFromCompliance`, `sealedFromQtc`, `sealedQtcFromVolume`, `sealedAlignmentOptions`, `closestSealedAlignment` |
| `engine.vented` | `ventedAlignment`, `ventedPlausibility`, `ventedVolumeIssue`, `ventedTuningIssue` |
| `engine.vent` | `solveVent`, `ventLength`, `tuningFromLength`, `ventEffectiveLength` |
| `engine.pr` | `solvePr`, `prTuning`, `prMassForFp`, `prVas`, `prCmsFromVas`, `prFsWithMass`, `prMmdFromFs`, `prQms`, `prRmsFromQms` |
| `engine.filters` | `defaultFilter`, `filterCaption`, `filterWpr`, `filterFromWpr`, the eight `update*` → `edit(f, patch)` per class (delegating to `PassFilter.with` etc. — the class IS the impl, no `filters.ts` middle layer) |
| `engine.signal` | `driveVoltage`, `solveSignal` |
| `engine.simulation` | `sweep`, `maxCurves`, `solveBoxParams`, `passbandRef`, `rolloffFreq`, `classifyFinite`, `classifyFiniteIssues`, `classifyFlatClamp`, `classifyMaxFinite`, `chartsFor`, `defaultChart` |
| `engine.issues` | `outOfRange`, `targetUnreachable`, `nonPhysicalQuantity`, `quantityOutOfBand`, `positiveValueIssue`, `nonNegativeValueIssue` |
| `engine.box` | `simulatableBoxType`, `defaultBoxType` |

Each component's interface and class live in the folder that already holds its physics
(`engine/filters/`, `engine/solvers/`, …); the free functions those folders export today become
the class's methods where they read settings, and stay free where they are pure math the class
calls. `packages/design/engine/filters.ts` (the middle layer) is deleted. A component member
that would only forward to a pure function is not written — the caller gets the function via
the component's method that does real work, or the function is the method.

The gate's allowlist (`architecture-engine-boundary.test.ts`) still names one door; its header
gains the sentence: the door hands out a graph of components, not a method per function.
The `Engine` surface ratchet in G becomes: `Engine`'s own members are components only — a new
method directly on `Engine` fails.

Ruling 4 with this shape: a domain object is constructed with only the areas it uses
(`OpenIsdDriverSpec` takes `DriverEngine` and `IssueEngine`, not the aggregate). Nothing
reaches `otherObject.engine`. The aggregate appears in exactly one file: `appState.ts`.

### C. One name per filter variant

`packages/design/engine/types.ts` declares each variant as an exported named interface —
`PassFilterSpec`, `AllpassFilterSpec`, `LinkwitzFilterSpec`, `ParametricEqFilterSpec`,
`PeakHighpassFilterSpec`, `StaticGainFilterSpec`, `RaisedCosineFilterSpec`, `ShelfFilterSpec` —
and `Filter` is their union. Every `Extract<Filter, …>`, every private `type Spec`, every
`PassSpec` becomes the name. Also the patch types: `PassFilterPatch = Partial<Pick<PassFilterSpec, …>>`
declared once beside the spec.

### D. Cohesive components instead of a threaded engine

32 functions in `packages/design/domain` take `engine: Engine`. Group by responsibility into
classes constructed once with the engine; callers hold the component, never the engine of
another object.

Representative:
- `winIsdDriverConverter.ts` — its functions become `WinIsdDriverConverter` (constructed with
  the engine; today it builds its own at line 750).
- `winIsdProjectConverter.ts` — `WinIsdProjectWriter`.
- `projectFormulaDq.ts`, `driverSolverParamsOf.ts`, box windows (`ventedChamberWindow.ts`,
  `openISDBox.ts` `requiredField(..., engine.positiveValueIssue)`) — the owning domain object
  already holds an engine; these become its methods or receive the one collaborator they use.

One commit per component. The ratchet (below) names what is left.

### E. The Filters hook — own vocabulary, no engine

`packages/ui/src/hooks/OriginalFilters-hooks.ts`: `OriginalFiltersAPI` stays as the interface the `.vue`
and its tests depend on. `class OriginalFilters implements OriginalFiltersAPI` is constructed with
`project`, `changed` and `engine.filters` — the one component it uses, not the whole engine.

```ts
add(type: FilterType): string
remove(id: string): void
caption(f: Filter): string
editPass(f: PassFilterSpec, patch: PassFilterPatch): void   // filters.editPass + store
editAllpass / editLinkwitz / editParametricEq / editPeakHighpass /
editStaticGain / editRaisedCosine / editShelf
```

`replaceFilter` goes private. The eight editors under `packages/ui/src/ui/shells/original/filters/`
call `api.editShelf(f, {fc: numFrom($event)})`; the `replace` emit and `OriginalFilters.vue`'s
handler go. Composition root `OriginalShell-hooks.ts:454`: `new OriginalFilters(project, projectChanged)`.

### H. A free function taking an object is a missing method (ruling 7)

`foo = getFoo(engine, someOther)` where the function reads or writes `someOther` is
`someOther.foo()` written outside the class. The DQ projection is the case John named.

Sites this session alone: `projectFormulaDq(fields, handles, issues)` → method on
`OpenIsdDriverSpec`; `driverSolverParamsOf(specs, engine)` → `OpenIsdDriverSpec.solverParams`;
`cellClassFor(cellOf, key)` (`packages/ui/src/logic/useDriverCells.ts`) → on the cell;
`chartBlockingReasonsFor(issues, cellOf)`, `inconsistentInputReasonsFor(issues)`
(`DriverEditorModal-hooks.ts`) → on the driver; `provenanceOf(cell)` → `cell.provenance`.

Rule of thumb for the rewrite: the first parameter that is one of our own classes is `this`.
Where the function needs the engine as well, the class already holds it (ruling 4).

Gate (in G): `architecture-no-extension-functions.test.ts` — an exported function in
`packages/design/domain` or `packages/ui/src/logic` with a parameter typed as one of our own
domain classes or field atoms (`OpenISDDriver`, `OpenISDProject`, `OpenIsdDriverSpec`,
`Readable<…> & …`, `Filter`, `Engine`). Ratchet from today's baseline; each move strikes one.

### F. Lint, not prose (ruling 3)

`eslint.config.js` (typescript-eslint recommended + vue essential today):

| Rule | Catches |
|---|---|
| `no-restricted-syntax`: `ExportAllDeclaration`, `ExportNamedDeclaration[source]` — everywhere except the sanctioned entry points (`packages/*/index.ts`, `packages/design/{engine,domain,fields}/index.ts`) | re-exports (`architecture-no-reexports.test.ts` then retires or ratchets) |
| `no-restricted-syntax`: `TSIndexedAccessType > TSTypeReference[typeName.name="Engine"]` | `Engine['x']` |
| `no-restricted-syntax`: `CallExpression[callee.property.name="bind"][arguments.0.name="engine"]` | `.bind(engine)` |
| `no-restricted-syntax`: `TSTypeReference[typeName.name="Extract"] > TSTypeParameterInstantiation > TSTypeReference[typeName.name="Filter"]` outside `types.ts` | a second name for a variant |
| `@typescript-eslint/explicit-module-boundary-types`, `prefer-readonly`, `no-unnecessary-condition`, `switch-exhaustiveness-check` (type-aware set, on top of recommended) | weak types at boundaries, missed cases |
| `eslint-plugin-import` `import/no-cycle` (new dependency) | the fields↔engine module cycles hit twice this session |

### G. Gates (ruling 6)

Same idiom as `architecture-no-globals.test.ts` / `architecture-no-casts.test.ts`: AST-based,
header block, a planted failure proved once.

| Gate | Catches |
|---|---|
| `packages/design/test/architecture-no-forwards.test.ts` | a function/method whose entire body is `return g(<own params, same order>)`, across `packages/design` and `packages/ui/src`; a hook member forwarding for a `.vue` is allowed only inside `packages/ui/src/hooks/` (ruling 1) |
| one-composition-root, in `architecture-engine-boundary.test.ts` | `createEngine(` outside `appState.ts` and `test/` |
| engine-parameter ratchet, `packages/design/test/architecture-engine-parameter-ratchet.test.ts` | baseline = today's list of the 32 sites; a new one fails, a removed one must be struck from the baseline |
| aggregate stays an aggregate | `Engine` has the area members from B and no methods; the aggregate type is named outside `appState.ts` and `test/` by nobody — a consumer names an area interface |

## Order

1. C — names. Mechanical, no behaviour change.
2. A + B — `Engine` interface + factory, then one component at a time (`filters` first, since
   E depends on it), each a commit: interface, private class, callers moved to
   `engine.<component>.method`, the `Engine` forwards for that group deleted.
3. E — Filters hook + editors.
4. F + G — lint rules and gates, each with its planted failure.
5. D + H — one commit per component or class; both ratchet baselines shrink each time.

## Verification

- `npm run typecheck`; `npm run lint` (new rules red on a planted violation, green without).
- `npx vitest run packages/design/test/architecture-*.test.ts` after each of A/B/G.
- `npx vitest run packages/ui/test/hooks/OriginalFilters-hooks.test.ts` + filter editor tests after E.
- `npx playwright test` on the Filters tab spec after E: add a shelf, change fc, caption updates.
- Commit hook runs the full suite. No AI attribution lines.
