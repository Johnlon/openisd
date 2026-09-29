# PLAN_openisdproject_split

`packages/design/domain/project/openISDProject.ts`, 1377 lines, one class. Plan only — no code
changed by this file.

## Responsibilities (current, one class)

| # | Responsibility (one sentence) |
|---|---|
| 1 | Mints and holds this project's identity (`#uuid`, `wrap`/`wrapWithIdentity`/`wrapSession`, `builder`, `empty`) |
| 2 | Holds the saved/edited/what-if layers and switches between them (`#saved`/`#edited`/`#whatif`, `#slot`/`#root`, `save`/`cancel`/`beginWhatIf`/`cancelWhatIf`/`resetWhatIf`/`isModified`/`isWhatIfActive`) |
| 3 | Re-derives every solved field on construction or on any write (`#resolve` and its five private helpers) |
| 4 | Builds the embedded driver and box windows onto the current record (`#driverOver`/`#boxOver`, `driver`/`box` getters, `setDriver`/`loadDriver`) |
| 5 | Exposes array-level driver facts that are not facts about the driver itself (`nDrivers`/`wiring`/`vcTempRise_K`/`Rs_ohm`/`driverAddedMass_kg`/`alfaVC_per_K`/`loading`) |
| 6 | Exposes project metadata (`name`/`creator`/`created`/`modified`/`description`) |
| 7 | Exposes the Advanced/Compatibility settings (`filters`/`forceFlatResponse`/`useTransmissionLinePortModel`/`rgAtDriverSide`/`circuitModel`/`splGraphIsXmaxLimited`/`lossMode`/`winisdDriverModel`/`winisdVaModel`/`applyWinisdSettings`) |
| 8 | Exposes chart/cursor view state (`graphs`/`charts`/`cursorF`/`pinnedF`/`cursorLocked`/`dragRange`/`traceColor`/`sweepN`) |
| 9 | Solves the drive power/voltage pair (`powerDrive_W`/`driveVoltage_V`/`#usableReOver`/`#settleSignal`) |
| 10 | Exposes the four environment conditions, each defaulting to the app's Options value (`envTempK`/`envHumidityPct`/`envPressurePa`/`envUseWinisdAirModel`/`#envFieldsOver`) |
| 11 | Converts this project to and from `.wpr`/`.owpr` text (`toWprText`/`fromWprText`/`toOwprText`/`fromOwprText`/`cloneSession`/`cloneSavedProject`) |
| 12 | Runs a sweep or max-curves solve against this project's own stored parameters (`#enclosureParams`/`#sweepParams`/`#boxVolume_m3`/`#boxSpecificParams`/`#engineBoxType`/`sweep`/`maxCurves`/`#boxSweepIssues`/`#ventSweepIssues`/`#prSweepIssues`/`boxParamsIssues`/`passbandRef`/`rolloffFreq`/`classifyFinite*`/`impedancePeak`/`ventAchievedFb`/`ventMaxReachableFb`) |
| 13 | Notifies subscribers on every change (`#listeners`/`subscribe`/`batch`/`#notify`/`recalc`) |

## Proposed modules

Facade holding live state: **`OpenISDProject`** — the ONLY one with `#saved`/`#edited`/`#whatif`.
Everything else takes a lens (`SimpleField` over one slot) or the facade's own public surface as a
collaborator, passed in, never constructed.

| Module | Responsibility | Public surface | Collaborators (passed in) |
|---|---|---|---|
| `openISDProject.ts` (facade, kept) | 1, 2, 13 — identity, layer state, notification | `builder`/`empty`/`wrap*`/`uuid`/`save`/`cancel`/`beginWhatIf`/`cancelWhatIf`/`resetWhatIf`/`isModified`/`isWhatIfActive`/`subscribe`/`batch`/`recalc`, plus every getter below (thin delegation) | none — this is the composition root for the project |
| `projectResolve.ts` | 3 — one function `resolveProject(directRoot, engine, driverOver, boxOver): ProjectIssues` | `resolveProject(...)` | direct root lens, `Engine`, the two window-builder functions |
| `projectMeta.ts` | 6 | `ProjectMeta.wrap(lens): ProjectMeta` with `name`/`creator`/`created`/`modified`/`description` | lens over `meta` |
| `projectAdvanced.ts` | 7 | `ProjectAdvanced.wrap(lens, engine): ProjectAdvanced` with each getter, `applyWinisdSettings()` | lens over `advanced`/`filters`, `Engine` (for `LossMode`) |
| `projectChartsView.ts` | 8 | `ProjectChartsView.wrap(lens, cursorState): ProjectChartsView` | lens over `charts`; the four non-persisted cursor fields move here as constructor-injected mutable cells, not module globals |
| `projectSignal.ts` | 9 | `ProjectSignal.wrap(lens, engine, usableRe, rsOhm): ProjectSignal` with `powerDrive_W`/`driveVoltage_V` | lens over `signal`, `Engine`, a `() => number \| null` for the driver's usable Re, a `() => number` for `Rs_ohm` |
| `projectEnvironment.ts` | 10 | `ProjectEnvironment.wrap(lens, engine): ProjectEnvironment` with the four env getters | lens over `environment`, `Engine` |
| `projectSerialization.ts` | 11 — free functions, not a class (no state of its own) | `projectToWprText(project, engine)`, `projectFromWprText(text, engine)`, `projectToOwprText(project)`, `projectFromOwprText(text, engine)` | the facade (public surface only) or a fresh one it builds |
| `projectSweep.ts` | 12 | `ProjectSweep.wrap(project, engine): ProjectSweep` with `sweep`/`maxCurves`/`boxParamsIssues`/`passbandRef`/`rolloffFreq`/`classifyFinite*`/`impedancePeak`/`ventAchievedFb`/`ventMaxReachableFb` | the facade's PUBLIC surface (`box`/`driver`/`filters`/`circuitModel`/…) — same access a UI caller has, no private reach-through |
| `openISDDriverEmbedded.ts`, `openISDBox.ts` (unchanged) | 4, 5 — already own classes | unchanged | unchanged |

`OpenISDProject` keeps every existing public method/getter, each a one-line delegation to the
matching module — **no signature changes**, so `packages/ui`/`packages/persistence` callers do
not change at all (see Risks).

## What moves, what stays

| Moves | Stays | Why |
|---|---|---|
| `#resolveVentGeometry`/`#resolveVentCount`/`#resolveEnvironment`/`#settleSignal`/`#usableReOver` → `projectResolve.ts` | `#resolve()`'s call into `resolveProject(...)`, one line | the resolve logic touches no `#saved`/`#edited` directly (already works through a `directRoot` lens) — a pure function of a lens |
| `name`/`creator`/`created`/`modified`/`description` bodies → `projectMeta.ts` | the five getters, delegating | mechanical group, no shared state with anything else |
| `filters`/`forceFlatResponse`/.../`applyWinisdSettings` bodies → `projectAdvanced.ts` | the getters, delegating | same |
| `graphs`/`charts`/`cursorF`/`pinnedF`/`cursorLocked`/`dragRange`/`traceColor`/`sweepN` bodies → `projectChartsView.ts` | the getters, delegating | `charts` getter itself (`this.#engine.chartsFor(...)`) reads `box`, so it takes the facade's `box` getter as a collaborator, not a lens alone |
| `powerDrive_W`/`driveVoltage_V` bodies → `projectSignal.ts` | the getters, delegating | already isolated behind `#powerDriveOver`/`#driveVoltageOver`, which take a root lens |
| env getters/setters bodies → `projectEnvironment.ts` | getters, delegating; the five `@deprecated` setters (unchanged, still one-line forwards) | already isolated behind `#envFieldsOver` |
| `toWprText`/`fromWprText`/`toOwprText`/`fromOwprText`/`cloneSession` bodies → `projectSerialization.ts` | thin static/instance forwards | `fromWprText`/`fromOwprText` are already one-line delegations to `winIsdProjectToOpenIsdProject`/schema parse — this only relocates the wrapper, mirrors the `driverYmlToOpenisdAndWdr.ts` split already done |
| `#enclosureParams`/`#sweepParams`/`#boxVolume_m3`/`#boxSpecificParams`/`#engineBoxType`/`sweep`/`maxCurves`/`#box*SweepIssues`/`boxParamsIssues`/`passbandRef`/`rolloffFreq`/`classifyFinite*`/`impedancePeak`/`ventAchievedFb`/`ventMaxReachableFb` → `projectSweep.ts` | the public method signatures, delegating | biggest and most interdependent block; moving it as one unit avoids inventing a boundary inside it that is not there today |
| `#driverOver`/`#boxOver`/`driver`/`box`/`setDriver`/`loadDriver` and the array-level driver fields (5) | stay in `openISDProject.ts` | these already build `OpenISDDriverEmbedded`/`OpenISDBox` and every OTHER module above needs `driver`/`box` themselves — keeping them on the facade avoids a cycle (every module would otherwise import the module that imports it) |
| `#uuid`/`#saved`/`#edited`/`#whatif`/`#committed`/`#current`/`#ensureEditing`/`#slot`/`#root` | stay in `openISDProject.ts` | this IS the one facade's state; nothing else may hold it |
| `#listeners`/`subscribe`/`batch`/`#notify`/`recalc`/deprecated `notifyVentChanged`/`notifyPrChanged` | stay in `openISDProject.ts` | notification is a fact about the facade's own state changing, not about any one slot |

## Risks

| Risk | Detail |
|---|---|
| Private state crossing boundaries | `#resolve()`'s helpers currently close over `this.#issues` (write) and `this.#engine` (read) directly. Moving them to `projectResolve.ts` means `#issues` becomes a return value, not a field write from inside the helper — the facade assigns `this.#issues = resolveProject(...)` itself. No other private field is touched by any moved code once `driver`/`box` windows are passed in as already-built values. |
| Import cycle | `projectSweep.ts` takes the facade (`OpenISDProject`) as a constructor argument, so `openISDProject.ts` must import `ProjectSweep`'s TYPE without `projectSweep.ts` importing `OpenISDProject`'s type back — use a structural interface (`ProjectSweepSource`) in `projectSweep.ts` naming only the getters it reads (`box`, `driver`, `filters`, `circuitModel`, …), satisfied by `OpenISDProject` without a reverse import. Same treatment for `projectSerialization.ts`. |
| Import cycle, `projectChartsView.ts` | `charts` getter needs `box.boxType.value` — same structural-interface treatment (`{box: {boxType: Readable<BoxType>}}`), not the concrete `OpenISDProject`. |
| Callers outside `packages/design` | 13 files in `packages/ui`, 2 in `packages/persistence` (below) import `OpenISDProject` — none may see a signature change. This plan keeps every current method/getter name and type on the facade; only bodies move. |
| `packages/ui` callers (grep, unchanged after split) | `ui/src/types.ts`, `ui/src/hooks/OriginalFilters-hooks.ts`, `ui/src/hooks/OriginalShell-hooks.ts`, `ui/src/ui/shells/original/OriginalTune.vue`, `ui/src/hooks/AdvancedOptions-hooks.ts`, `ui/src/logic/presentationState.ts`, `ui/src/logic/fileImportExport.ts`, `ui/src/hooks/SealedAlignment-hooks.ts`, `ui/src/logic/focusedProjectContext.ts`, `ui/src/logic/useVentGroup.ts`, `ui/src/logic/usePrGroup.ts`, `ui/src/logic/appState.ts`, `ui/src/hooks/OriginalNewProject-hooks.ts` |
| `packages/persistence` callers (unchanged after split) | `persistence/src/repos/projectSchemaUpgrade.ts`, `persistence/src/repos/projectRepo.ts` |
| Test file scope | `packages/design/test/**` importing `openISDProject.ts` internals directly (rather than the domain barrel) will need import-path updates, same pattern as the two prior splits this session. Not enumerated here — a `grep` pass at implementation time, per the moves-only-first commit below. |
| Engine-side name collision | `packages/design/engine/sweep.ts` and `engine/charts.ts` already exist (different layer, different job — sweep solving and chart-id lists, not project state) — the new `projectSweep.ts`/`projectChartsView.ts` names must not be confused with them in review; no code conflict, naming risk only. |

## Commit order (moves only, behaviour unchanged)

1. `projectResolve.ts` — smallest, most self-contained (only reads a lens + engine)
2. `projectMeta.ts`
3. `projectEnvironment.ts`
4. `projectSignal.ts`
5. `projectAdvanced.ts`
6. `projectChartsView.ts`
7. `projectSerialization.ts`
8. `projectSweep.ts` — largest, last, so every smaller extraction is proven (typecheck + full suite green) before touching the highest-risk block
9. Final commit: trim `openISDProject.ts`'s doc comment to describe the new shape, delete now-dead imports

Each commit: typecheck + full `design`/`persistence`/`ui` suites green, zero test-expectation
edits, one commit per file per the standing rule.
