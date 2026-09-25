# A box always holds a radiator; mandatory metadata is non-null (2026-09-24)

## Context

Task #27 (100% coverage on engine/domain) found `?? ''` / `?? 0` fallbacks covered only by
`v8 ignore`. Root cause: `OpenISDDevice.#slot` is `SimpleField<OpenISDDeviceJson | null>`,
shared by the driver (never null) and the embedded radiator (null when the box's `component`
is null). Today `brand`/`model`/`manufacturer` read `string | null`. Target: `string`, non-null.

Rulings (John, 2026-09-24):
- Absence is `null`, one spelling, as shipped. No sentinel class.
- Avoid nullable unless there is no other option. Delete pointless null checks. Don't suppress them.
- A box always holds a radiator. No `NullPassiveRadiator`: the PR editor writes to the
  radiator, and a null object would have to throw on those writes.
- Drop `Clearable` from brand/model/manufacturer/project description. The UI only calls `.set()`.

Where projects come from today:
- `OpenISDProject.empty()` ([openisdDomain.ts#L2096-L2116](http://localhost:8000/winisd/openisd/packages/design/domain/openisdDomain.ts#L2096-L2116)): has a blank radiator.
- The box builders (sealed, vented, …) and projects loaded from saved files: can have no radiator (`component: null`).

After this pass, every project has a radiator, blank until the user picks or types one.

## Changes

**Schema** ([openisdSchema.ts](http://localhost:8000/winisd/openisd/packages/design/domain/openisdSchema.ts))
- L660 `component: openISDDeviceJsonSchema.nullable()` → `openISDDeviceJsonSchema`. No
  migration: there are no saved files to carry forward (John, 2026-09-24).
- L1164 `emptyBoxJson()` takes the radiator record as a parameter and drops `component: null`
  at L1189.

**Builders** ([openisdTransforms.ts](http://localhost:8000/winisd/openisd/packages/design/domain/openisdTransforms.ts))
- Every `emptyBoxJson()` call (L170, 210, 238, 281, 335, 381) passes
  `OpenISDPassiveRadiatorStandalone.empty(engine, appContext).clonePassiveRadiator()`.
- `build()` L132 keeps `update(this.radiatorChoice)` when one was chosen.
- Remove the "component stays null HERE" comment at L384.
- `OpenISDProject.empty()` drops its now-redundant `.radiator(empty)` call and its "present
  FROM THE START" paragraph; the schema holds that fact now.

**Domain** ([openisdDomain.ts](http://localhost:8000/winisd/openisd/packages/design/domain/openisdDomain.ts))

| Where                        | Before                                                                  | After                                                                                         |
|------------------------------|-------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------|
| `OpenISDDevice.#slot`        | `SimpleField<OpenISDDeviceJson \| null>`                                | `SimpleField<OpenISDDeviceJson>`                                                              |
| brand/model/manufacturer     | `Readable<string \| null> & Entered & Writable<string> & Clearable`     | `Readable<string> & Entered & Writable<string>` via `SetOnlyFieldImpl` (cell.ts)            |
| providedBy/comment/added     | nullable + Clearable (schema-optional)                                  | unchanged; `#buildMeta` loses its `record === null` branch and 'radiator slot is empty' throw |
| `OpenISDPassiveRadiator.slot`, `prSpec` | nullable, null guard                                         | non-null, guard deleted                                                                       |
| `uuid()` / `detach()`        | throw 'no radiator is chosen'                                           | throws deleted                                                                                |
| `update()`                   | `v8 ignore` absent-record guard                                         | guard deleted                                                                                 |
| `configurePR` L781           | `if (!current)` branch                                                  | single merge path                                                                             |
| solver guard L2572           | `&& component !== null`                                                 | deleted; a blank radiator solves to null + dq, as `OpenISDProject.empty()` projects do today  |
| project `description` L2278  | nullable + Clearable                                                    | `SetOnlyFieldImpl`: `Readable<string> & Entered & Writable<string>`                         |

**Pointless null checks deleted** (with their `v8 ignore` comments)
- `driverYmlToOpenisdAndWdr.ts`: `brand`/`model`/`manufacturer` `?? ""`
- `openIsdProjectToWinIsdProject.ts:61` `description ?? ''`; `:116,130,132` `volume_m3 ?? 0` (already non-null today)
- `OriginalShell-hooks.ts:889` `description.value ?? ''`
- `PREditModal.vue:51` `radiator.model.value ?? ''`
- Every other fallback on these fields that typecheck exposes

## Tests (TDD — red first)

Write these failing tests first:
1. `domain.test.ts`: a sealed-builder project with no radiator chosen accepts
   `radiator.spec.Fs_hz.set(12)` and reads `12`. Today this throws 'radiator slot is empty'.
2. `domain.test.ts`: a PR-box project with a blank radiator solves to null outputs plus dq,
   and does not skip the solve.

Rewrite (the behavior changed; these are not deletions to go green):
- L1115-1122 "empty-slot contract" → covered by new test 1.
- L1142 `radiator.brand.clear()` → `brand.set('')`; assert `'clear' in brand` is false.
- L2988 `p.description.clear()` → same pattern.

The arch test `architecture-no-contradictory-inheritance.test.ts` is unchanged: the
`SetOnlyFieldImpl` shape (non-null, no Clearable) already passes.

## Verification
- `npm run typecheck`: 0 new errors in design/persistence/ui.
- `npx vitest run packages/design packages/persistence packages/ui`.
- Coverage on the 3 domain files: fallback lines gone, no new `v8 ignore`.
- `grep -rn "radiator slot is empty\|no radiator is chosen" packages` finds nothing.

---

# Part 2 (own commit): drive voltage V / input power P (John, 2026-09-24)

Replaces the Step 3h model shipped 2026-09-23 (V never E, P never C, V can be N).

## Types ([openisdDomain.ts#L2760-L2835](http://localhost:8000/winisd/openisd/packages/design/domain/openisdDomain.ts#L2760-L2835))

| Field            | Before                                                                                      | After                                                                                                   |
|------------------|---------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| `driveVoltage_V` | `Readable<number \| null> & Calculated & Writable & Clearable & Calculatable & Unsolvable`  | `Readable<number> & Entered & Calculated & Writable<number> & Clearable & Calculatable<number>` — never N |
| `powerDrive_W`   | `Readable<number \| null> & Entered & Writable & Clearable`                                 | `Readable<number \| null> & Entered & Calculated & Writable<number> & Clearable & Calculatable<number> & Unsolvable` |

V drops `Unsolvable`. The arch test's named Writable-without-Entered exception for `driveVoltage_V` is deleted.

## Rules (Re = driver's usable Re)

| Event                   | Re known                                                        | Re missing                  |
|-------------------------|-----------------------------------------------------------------|-----------------------------|
| New project             | P = 1 W E, V = √(P·Re) C                                        | V = 1 V C, P N              |
| User types V            | V E, P = V²/Re C                                                | V E, P N                    |
| User types P            | P E, V = √(P·Re) C (even if V was E)                            | P input read-only; P's dq says Re is missing |
| Clear V                 | P = 1 W E, V = √(P·Re) C                                        | V = 1 V C                   |
| Clear P                 | V's current value becomes E; P = V²/Re C                        | P N                         |
| Re becomes missing      | —                                                               | V keeps its value and becomes E; P N |
| Re becomes known        | V E → P = V²/Re C; V C → P = 1 W E, V = √(P·Re) C               | —                           |

Invariants:
- While Re is known, P = V²/Re, and exactly one of P/V is E: the one entered last. The other is C.
- V is never null, so sweeps always have an `eg`.
- V is never below 10 mV, the smallest value the UI's 2 dp shows (John, 2026-09-24). `V.set`
  and `P.set` refuse a value that would go lower.

`.wpr`: export leaves `SignalSource P` out, with a warning, when P is blank (no Re). It never
writes 0. Import states P only when the driver has a usable Re.

## Code
- `engine/signal.ts` `solveSignal`: takes V (with its E/C state), P and Re, applies the table. No `setNotAvailable` on V.
- `#driveVoltageOver`: stores E entries; `.set(v)` writes V E, no Re throw; `.clear()` → V C default.
- `#powerDriveOver`: gains `setCalculated`/`setNotAvailable` (solver writes P C / N).
- Builder `build()` `project.powerDrive_W.set(1)`: keep; the solver rewrites P to N / V to 1 V C when Re is missing.
- `sweep()` L3051: the `eg === null` branch is deleted.
- UI: V input shows E/C; P input shows E/C/N.

## Agreed scenarios (John, 2026-09-24): the acceptance cases, Re = 8 Ω

| #   | Re, and what you typed last | Action     | Step 3h: P, V, charts                        | Now: P, V, charts                                      |
|-----|-----------------------------|------------|----------------------------------------------|--------------------------------------------------------|
| 1   | Re none, new project        | open it    | P 1 E, V N, no charts                        | P N, V 1 C, charts                                     |
| 2   | Re none, nothing typed      | type V = 4 | P 1 E, V N → rejected, no charts             | P N, V 1 C → P N, V 4 E, charts at 4 V                 |
| 3   | Re none                     | type P = 2 | P 1 E, V N → P 2 E, V N, no charts           | P N, locked with "Re missing"; V unchanged, charts stay |
| 4   | Re 8, you typed P 2         | clear V    | P 2 E, V 4 C → P N, V N, no charts           | P 2 E, V 4 C → P 1 E, V 2.83 C, charts                 |
| 5   | Re 8, you typed P 2         | clear P    | P 2 E, V 4 C → P N, V N, no charts           | P 2 E, V 4 C → P 2 C, V 4 E, charts                    |
| 6   | Re 8, you typed P 5         | remove Re  | P 5 E, V 6.32 C → P 5 E, V N, no charts      | P 5 E, V 6.32 C → P N, V 6.32 E, charts at 6.32 V      |
| 7   | Re 8, you typed V 4         | remove Re  | P 2 E, V 4 C → P 2 E, V N, no charts         | P 2 C, V 4 E → P N, V 4 E, charts at 4 V               |

## Tests (red first)
One `domain.test.ts` case per scenario row above (the "Now" column is the assertion), plus
the invariant after every P/V/Re write.
`engine/signal` unit tests for the pure solve.
