# Encapsulation and layering — replacement doctrine

Status: LIVE DESIGN CONVERSATION, in progress. Sequential — each point in the exact order it was
made, no thematic grouping.

- A repo holding an `OpenISDDriver` reference purely to call its own public `toOwdrText()` and
  write bytes isn't automatically safe — it is a risk if something else holds the same reference
  and mutates the state.

- A read-only-shaped interface (query methods only, no mutators) is still not safe: the party
  holding it may not be able to mutate, but they may have the expectation that it won't be
  mutated elsewhere.

- The only easily-reasoned-about architecture is where there is a single holder of a reference,
  and if values need to be returned, they are immutable copies.

- Upper layers are allowed to see the layer below, and typically not lower than that.

- Whilst a domain object may be visible within multiple layers, those domain objects may have
  internal state that is highly encapsulated within some layers and not within others.

- Example: `OpenISDDriver` provides a public API that is a utility to upper layers to access the
  properties (encapsulated state, and calculations based on that state) — but not direct access
  to the internal source of that state.

- As well as internal values that may not be accessed by certain layers, there are also
  datatypes that apply to that internal state that may not be known to those same excluded
  layers.

- Example: `OpenISDDriver` exports values based on its internal state `OpenISDDriverJson` and
  the engine. The UI layer and the logic layer have no access to the `OpenISDDriverJson`
  datatype. However, that internal datatype IS the very same datatype used in the store for that
  domain object. The repo class is a sibling of the domain object — the repo exposes the domain
  object on its API, not the internal `OpenISDDriverJson`. Beneath the repo there is the store
  layer, which operates internally in terms of `OpenISDDriverJson` — `OpenISDDriverJson` is the
  very same type that hits the browser storage. Therefore, the UI or logic layer cannot see
  `OpenISDDriverJson`, or any method on `OpenISDDriver` that might return/receive it. This is NOT
  true of the repo layer, which typically unpacks the domain object to its internal object and
  passes that internal object to storage directly.

- The store is effectively a sibling of the JSON object in the same manner that the domain
  object is a sibling of the repo.

- What you can see is that if the datatype `OpenISDDriverJson` is private to the file
  `OpenISDDriver`, then the repo and store cannot access it either.

- This discussion applies also to `OpenISDProject`.

- Additionally: `OpenISDProject` is entitled to hold an `OpenISDDriver` as a member, and
  `OpenISDDriver`/`OpenISDProject` are siblings.

- `OpenISDProject` is not exposed to the app directly — instead there is `ManagedProject`, which
  holds 2 or 3 copies of the project at any given time as internal layer state.

- The `ManagedProject` has multiple responsibilities:
  - It wraps `OpenISDProject` and provides a layer-management API supporting edits and
    what-ifs — a) ground layer, b) committed layer, c) edit/whatif layer. The "effective
    layer" is b) unless c) is active, in which case c) is the effective layer.
  - It must provide access to the properties of the active layer `OpenISDProject`.
  - It must provide a subscription/notification facility for changes of the `OpenISDProject`
    that is the effective layer above.

- The actual current API of `ManagedProject`, read from `managedProject.ts`, organised by the
  three responsibilities above, each method's purpose and return type stated:

  - **Access to the properties of the active (effective) layer:**
    - `cell(field: SpecField): Cell` — one driver field's value and provenance.
    - `metaCell(field: MetaField): MetaCell` — one driver metadata field (brand/model/manufacturer/provided_by/comment/added).
    - `toEngineDriver(): EngineDriver | null` — the resolved, engine-ready driver the charts sweep; null if nothing can be drawn.
    - `errors(): DriverError[]` — what the engine says stops this driver simulating.
    - `consistencyIssues(): ConsistencyIssue[]` — stated fields that contradict each other beyond their own precision.
    - `enter(field: SpecField, value: number): void` / `clear(field: SpecField): void` — write/clear one driver field.
    - `enterMeta(field: MetaField, value: string): void` / `clearMeta(field: MetaField): void` — write/clear one driver metadata field.
    - No keyed/generic accessor survives on this class at all (third ruling, below) — every
      field, including the vent/PR-group fields, has its own flat named pair. Where a caller
      needs runtime field-id dispatch (a `v-for` over a field list), the `switch` lives in the
      calling UI code (`useVentGroup.ts`/`usePrGroup.ts`), not as a method here.
    - `enterBoxVolume_m3(value)` / `clearBoxVolume_m3()` / `boxVolumeProvenance(): Provenance` — provenance-marking + vent-group-solving counterpart to the RAW `boxVolume_m3`/`setBoxVolume_m3` below (key `Vb`).
    - `enterBoxTuning_Fb_hz(value)` / `clearBoxTuning_Fb_hz()` / `boxTuningProvenance(): Provenance` — same, for `Fb`.
    - `enterVentDiameter_m(value)` / `clearVentDiameter_m()` / `ventDiameterProvenance(): Provenance` — same, for `ventD`.
    - `enterVentLength_m(value)` / `clearVentLength_m()` / `ventLengthProvenance(): Provenance` — same, for `ventL`.
    - `enterVentWidth_m(value)` / `ventWidthProvenance(): Provenance` — enter-only (no clear: `ventW` isn't a vent-GROUP member, only an entry field — `useVentGroup.ts`'s `clearVentField` never calls it).
    - `enterVentHeight_m(value)` / `ventHeightProvenance(): Provenance` — same, for `ventH`.
    - `enterPrFp_hz(value)` / `clearPrFp_hz()` / `prFpProvenance(): Provenance` — provenance-marking + PR-group-solving counterpart to the RAW `prFp_hz`/`setPrFp_hz` below.
    - `enterPrAddedMass_kg(value)` / `clearPrAddedMass_kg()` / `prAddedMassProvenance(): Provenance` — same, for `prMadd`.
    - `prVas_m3(): number` / `setPrVas_m3(value: number): void`, `prFs_hz()` / `setPrFs_hz(value)`, `prQms()` / `setPrQms(value)`, `prFsMass_hz(): number` (read-only, derived) — datasheet-vocabulary PR views; writing one is a REVERSE-SOLVE into the canonical `Cms`/`Mmd`/`Rms` fields, not simple storage.
    - `frcHz(): number` / `setFrcHz(value: number): void` — rear-chamber tuning target for bandpass6/ABC, RAW, RELATIONLESS (always reported Entered).
    - `boxVolume_m3(): number` / `setBoxVolume_m3(value: number): void` — the box's Vb, RAW (no provenance mark, no solve).
    - `boxTuning_Fb_hz(): number` / `setBoxTuning_Fb_hz(value: number): void` — the box's tuning frequency, RAW.
    - `frontVolume_m3(): number` / `setFrontVolume_m3(value: number): void` — bandpass4's own front-chamber volume, RAW.
    - `boxQl(): number` / `setBoxQl(value): void`, `boxQa()`/`setBoxQa`, `boxQp()`/`setBoxQp` — the three box loss factors, RAW.
    - `ventShape()` / `setVentShape(value)`, `ventDiameter_m()` / `setVentDiameter_m(value)`, `ventWidth_m()` / `setVentWidth_m(value)`, `ventHeight_m()` / `setVentHeight_m(value)`, `ventLength_m()` / `setVentLength_m(value)`, `ventEndCorrection()` / `setVentEndCorrection(value)` — the active vent's own fields, each named (no `keyof OpenISDVent` generic — see the ruling below).
    - `ventArea_m2(): number` — the active vent's cross-sectional area (calculated).
    - `solveVentGroup(): void` / `solvePrGroup(): void` — trigger the vent/PR group solve.
    - `ventAchievedFb(): number | null`, `ventMaxReachableFb(): number | null`, `ventTargetUnreachable(): boolean`, `prTargetUnreachable(): boolean` — vent/PR tuning-reachability queries.
    - `ventEffectiveLength_m(): number` — the active vent's effective acoustic length (calculated).
    - `driveVoltage_V(): number` — drive voltage from input power and the effective driver's Re.
    - `sealedResonance(lossMode: LossMode, Rs: number, Ql: number, Qa: number): { Fsc: number; Qtc: number } | null` — sealed-box (or PR rear-chamber) resonance + system Q for a given loss model.
    - `prSystemTuning_hz(): number | null` — the passive-radiator system tuning ("Fh").
    - `portPipeResonance_hz(): number | null` — the vent tube's own organ-pipe resonance.
    - `enterPrDatasheet(d: {...}): void` — adopt a passive radiator from its datasheet vocabulary.
    - `prName()` / `setPrName(value)`, `prSd_m2()` / `setPrSd_m2(value)`, `prMmd_kg()` / `setPrMmd_kg(value)`, `prCms_m_per_N()` / `setPrCms_m_per_N(value)`, `prRms_Ns_per_m()` / `setPrRms_Ns_per_m(value)`, `prXmax_m()` / `setPrXmax_m(value)` — one passive-radiator intrinsic, each named (no `keyof OpenISDPassiveRadiatorRef` generic).
    - `prCount(): number` / `setPrCount(value: number): void`, `prAddedMass_kg()` / `setPrAddedMass_kg(value)`, `prFp_hz()` / `setPrFp_hz(value)` — RAW.
    - `envTempK(): number` / `setEnvTempK(value: number): void`, `envHumidityPct()` / `setEnvHumidityPct(value)`, `envPressurePa()` / `setEnvPressurePa(value)` — the project's environment fields (via `enter()`, held as Entered — `BUG_20260823_managed_user_setters_route_set_instead_of_enter.md`).
    - `envUseWinisdAirModel(): boolean` / `setEnvUseWinisdAirModel(value: boolean): void` — which air formula (CIPM-2007 vs WinISD's own).
    - `envUseAppLevelAirEnvironment(): boolean` / `setEnvUseAppLevelAirEnvironment(value: boolean): void` — which environment source (this project's own vs the app-level Options dialog).
    - `driverCount(): number` / `setDriverCount(value: number): void` — number of drivers (via `enter()`).
    - `wiring(): 'series' | 'parallel'` / `setWiring(value: 'series' | 'parallel'): void` — driver wiring.
    - `inputPower_W(): number` / `setInputPower_W(value: number): void`, `seriesResistance_ohm()` / `setSeriesResistance_ohm(value)` — drive power / Rs (via `enter()`).
    - `rgAtDriverSide(): boolean` / `setRgAtDriverSide(value: boolean): void` — generator-resistance placement option.
    - `circuitModel(): 'winisd' | 'gyrator'` / `setCircuitModel(value: 'winisd' | 'gyrator'): void` — circuit model.
    - `tlPortModel(): boolean` / `setTlPortModel(value: boolean): void` — transmission-line port model toggle.
    - `forceFlatResponse(): boolean` / `setForceFlatResponse(value: boolean): void` — force-flat-response option.
    - `splXmaxLimited(): boolean` / `setSplXmaxLimited(value: boolean): void` — Xmax-limited SPL option.
    - `vcTempRise(): number` / `setVcTempRise(value: number): void`, `driverAddedMass()` / `setDriverAddedMass(value)` — voice-coil temp rise / added mass (via `enter()`).
    - `alfaVC(): number` / `setAlfaVC(value: number): void` — voice-coil resistance temperature coefficient.
    - `sweepFmin_hz(): number` / `sweepFmax_hz(): number` / `sweepPoints(): number` and their `(value: number): void` setters — sweep range.
    - `filters(): Filter[]` — a COPY of the filter chain; `setFilters(value: Filter[]): void` — replace the whole chain; `addFilter(filter: Filter): void` — append one; `setFilter(id: string, patch: Partial<Filter>): void` — patch one filter by id; `removeFilter(id: string): void` — drop one filter by id.
    - `activeAlignment(): AlignmentKind` / `setActiveAlignment(value: AlignmentKind): void` — which alignment is active.
    - `isEntered(field: string): boolean` / `setEntered(field: string, value: boolean): void` — one field's entered-provenance flag.
    - `enteredSet(): Record<string, true>` / `setEnteredSet(value: Record<string, true>): void` — the whole entered-set, as a copy / replace-whole-set.
    - `snapshot(): OpenISDProject` — a COPY of the effective project, safe to read, impossible to write back through.
    - `toUiParams(): UiParams` — a live snapshot of every `UiParams` field, gathered from this project's own accessors.

  - **Layer management (edits and what-ifs):**
    - `mutate(fn: (project: OpenISDProject) => void): void` — change the effective project (box/vent/environment/signal/filters — anything not a driver field); re-reads the driver reference and notifies afterward.
    - `projectToPersist(): OpenISDProject` — the committed project for save/export/share; cancels an active what-if first (structural — the only route to a persistable project).
    - `isWhatIfActive(): boolean` — whether the overlay is a live what-if.
    - `beginWhatIf(): void` — open a what-if over committed state.
    - `resetOverlayToGround(): void` — reset an open what-if back to the design as loaded (from ground, not committed).
    - `cancelWhatIf(): void` — discard the what-if; the only way a what-if session ends (there is no commit).
    - `load(project: OpenISDProject): void` — adopt a project as freshly loaded; ground and committed both become independent copies; any open what-if is discarded.
    - `loadEmpty(): void` — replace the whole design with an empty one.
    - `clearDriver(): void` — drop the design's driver, back to no-driver-chosen.
    - `loadUiParams(p: Partial<UiParams>, box: AlignmentKind): void` — adopt a `UiParams` blob via the domain's own restore.

  - **Subscription/notification:**
    - `subscribe(fn: ManagedOpenISDProjectListener): () => void` — register a listener, returns an unsubscribe function.

  - **Not yet placed against the three responsibilities above — driver/project file IO (QO78):**
    - `loadDriverFromWdrText(text: string): void` — adopt a driver from WinISD `.wdr` text into the current design.
    - `loadDriverFromOwdrText(text: string): void` — adopt a driver from `.owdr` text (throws on malformed JSON).
    - `loadDriverFromPersistedText(text: string): string[]` — adopt a driver from persisted text, CHECKED (refuses malformed/unloadable, returns why).
    - `persistedDriverText(): string` — the committed driver as persisted text (what a save/share/ground-fingerprint embeds).
    - `committedDriverText(): string` — the committed driver's own serialisation, or an empty driver's if none chosen (the sanctioned text channel, since this class never hands out the live object).
    - `exportDriverWdr(): Result<Uint8Array<ArrayBuffer>>` — the committed driver as `.wdr` bytes.
    - `exportDriverOwdr(): Uint8Array<ArrayBuffer>` — the committed driver as `.owdr` bytes; cannot fail.
    - `exportWpr(now: Date, curve: SweepResult | null): Result<Uint8Array<ArrayBuffer>>` — the committed design as WinISD `.wpr` bytes.
    - `importWpr(bytes: Uint8Array): Result<OpenISDProjectMeta>` — adopt a `.wpr` file's bytes as this project.

  - **Static factories:**
    - `fromProject(project: OpenISDProject): ManagedOpenISDProject` — adopt a project as freshly loaded (ground and committed become independent copies of it).
    - `createEmpty(): ManagedOpenISDProject` — a project with nothing chosen.

- Whether a returned value is mutable is not what the rule turns on — a caller cannot tell from
  the outside whether a value it was handed is a live reference or a copy. What the rule turns on
  is whether the *datatype itself* is internal storage shape. `OpenISDBox` (`openisdProject.ts`)
  is a direct field of `OpenISDProjectJson` (`box: OpenISDBox`), and `OpenISDVent` /
  `OpenISDPassiveRadiatorRef` are components of `OpenISDBox`. That makes all three the same
  category as `OpenISDDriverJson` — internal storage datatypes — under the rule already stated
  above. Unlike `OpenISDDriverJson`, they are NOT private: they are exported from
  `@openisd/model`'s `index.ts` and typed directly into public methods —
  `ManagedOpenISDProject.activeVentField<K extends keyof OpenISDVent>(...)` /
  `setActiveVentField(...)`, `.prField<K extends keyof OpenISDPassiveRadiatorRef>(...)` /
  `setPrField(...)`, and `OpenISDProject.vent(i): OpenISDVent | undefined`. This is the same
  category of leak the doc's own rule forbids for `OpenISDDriverJson`, left open for
  `OpenISDVent`/`OpenISDPassiveRadiatorRef`/`OpenISDBox`.

- RULING, reversing the direction of the generic-keyed-accessor pattern (commit `7746e2e`'s
  duplicate-accessor removal, and the earlier QO54/`d8ba931` consolidation it extended): the
  named per-field accessors should have been KEPT, and the generic keyed function removed
  instead — the opposite of what shipped.

  Why: a generic accessor `thing<K>(field: K): ValueType` only stays type-safe per field if `K`
  is bound to something that carries each field's real type. `ProjectFieldId` got away with being
  a bare string-literal union because every box/env/signal field it covers happens to be a plain
  `number` — `cell(field): { value: number; state }` needed no per-field type map. The instant a
  domain has a NON-uniform field type (vent's `shape: 'round' | 'slotted'`, a string, not a
  number), the generic accessor needs a real per-field value-type map to stay honest — and
  building that map by hand (`VentFieldId` plus a parallel `VentFieldValue<K>` lookup) is
  re-deriving the named-accessor API anyway, at which point the generic indirection has bought
  nothing. Reaching for `keyof OpenISDVent` instead — the internal storage type, which already
  has the right per-field types attached — is the easy way out, and it is exactly what happened.
  This is not a one-off implementation slip fixable by adding `VentFieldId`: the generic-keyed
  pattern itself is what manufactures this failure mode the moment a domain's fields are not all
  the same primitive type. Named accessors (`boxVolume_m3()`/`setBoxVolume_m3()`, etc.) never
  have this problem — each method's return type is hand-written to the field's own real type, no
  shared type parameter exists to accidentally bind to internal storage.

- The generic-keyed-accessor pattern (many named per-field methods collapsed to one
  `thing(field: SomeFieldId)`) is not itself the mistake — it depends entirely on what
  `SomeFieldId` is. `cell(field: SpecField)` / `projectCell(field: ProjectFieldId)` key off
  `SpecField`/`ProjectFieldId`, dedicated public vocabulary types that exist ONLY to be a
  field-id enum and carry no storage shape. `activeVentField<K extends keyof OpenISDVent>(field:
  K)` / `prField<K extends keyof OpenISDPassiveRadiatorRef>(field: K)` instead key directly off
  the internal storage interfaces — `keyof OpenISDVent` puts `OpenISDVent`'s exact shape into the
  public method signature. `git log -S` confirms these predate the recent duplicate-accessor
  removal (`7746e2e`, the `d8ba931`/QO54 consolidation is where they were introduced), so this is
  the ORIGINAL design of the flat-field-accessor pattern for vent/PR, not a regression from the
  recent cleanup. The fix is a `VentFieldId`/`PrFieldId` vocabulary type, the same shape as
  `SpecField`/`ProjectFieldId`, with `activeVentField`/`prField` re-keyed off it instead of off
  `OpenISDVent`/`OpenISDPassiveRadiatorRef` directly.

- IMPLEMENTED: the ruling above, in full — not the narrower `VentFieldId`/`PrFieldId` fix, the
  actual ruling (named accessors kept, generic form reduced everywhere it safely could be).
  `OpenISDProject` (`packages/model/src/openisdProject.ts`) and `ManagedOpenISDProject`
  (`packages/ui/src/logic/managedProject.ts`) both regained every named accessor
  commits `7746e2e`/`9c6be08` deleted, plus NEW named accessors for every vent/PR field
  (`ventDiameter_m`/`ventWidth_m`/`ventHeight_m`/`ventLength_m`/`ventEndCorrection` and
  `prName`/`prSd_m2`/`prMmd_kg`/`prCms_m_per_N`/`prRms_Ns_per_m`/`prXmax_m`, each with a setter)
  that never had one. `OpenISDProject.ventField`/`setVentField`/`prField`/`setPrField` — the
  `keyof OpenISDVent`/`keyof OpenISDPassiveRadiatorRef` generics that were the actual leak — are
  now `#`-private, reachable only from inside the named accessors and the `ProjectFieldId`
  translation switches (`set`/`enter`/`clear`/`#fieldValue`) that still need to address an
  arbitrary field generically. `ManagedOpenISDProject.activeVentField`/`setActiveVentField`/
  `prField`/`setPrField` are GONE entirely (not privatized — nothing inside the class needed the
  generic form once the named accessors existed). `projectCell`/`enterProjectField`/
  `clearProjectField` stayed PUBLIC, deliberately: `ProjectFieldId` is a safe bare-string-union
  key (not a storage type), and `useVentGroup.ts`/`usePrGroup.ts` — sibling logic-layer modules,
  not methods of either class — call it with a `field: ProjectFieldId` PARAMETER, which `#`-private
  cannot serve. Every UI call site (`OriginalShell.vue`, `OgTune.vue`, `PREditModal.vue`,
  `PRDefineModal.vue`, `appState.ts`) and every affected test in `packages/model`/`packages/ui`
  was repointed at the named accessors; raw-vs-`enter()` semantics were preserved exactly per
  field (the box/vent/PR fields Part A restored stay RAW — no provenance mark, no group solve —
  matching their pre-`7746e2e` behavior; env/signal fields restored in Part B still route through
  `enter()`, since they always did). `packages/model`/`packages/ui` both typecheck clean; the
  targeted vitest files (141 tests across `packages/model` and `packages/ui`) pass.

- SECOND RULING (John, after reviewing the pass above): go further — a wide generic escape
  hatch is worse than a named surface even when it is type-safe in itself. Make
  `ManagedOpenISDProject.projectCell`/`enterProjectField`/`clearProjectField` fully `#`-private
  too, no exceptions for a safe key type.

  IMPLEMENTED: `#projectCell`/`#enterProjectField`/`#clearProjectField` are now `#`-private.
  Two kinds of remaining external caller needed real closure, not a raw-setter swap:
  - `useVentGroup.ts`/`usePrGroup.ts` need provenance-marking AND solve-triggering on a small
    CLOSED field set (`Vb`/`ventD`/`Fb`/`ventL`/`ventW`/`ventH`, `prFp`/`prMadd`) — the RAW named
    accessors don't do either, so they were never a substitute. New methods
    `enterVentGroupField`/`clearVentGroupField`/`ventGroupFieldProvenance` and
    `enterPrGroupField`/`clearPrGroupField`/`prGroupFieldProvenance`, typed against local
    `VentGroupField`/`VentGroupEntryField`/`PrGroupField` unions in `managedProject.ts` (not
    imported from the hook files, to avoid a type-only import cycle — both already
    `import type { ManagedOpenISDProject }`), wrap the private generic form internally.
  - `prVas`/`prFs`/`prQms`/`prFsMass` (`OriginalShell.vue`, `PREditModal.vue`) are reverse-solve
    datasheet views, not simple storage — new named methods `prVas_m3`/`setPrVas_m3`,
    `prFs_hz`/`setPrFs_hz`, `prQms`/`setPrQms`, `prFsMass_hz` (read-only) on both classes,
    delegating to the same `cell`/`enter` bodies `OpenISDProject` already had (no duplicated
    formulas). `frcHz`/`setFrcHz` — RAW, RELATIONLESS, never had a named pair before — got one
    too (`OriginalShell.vue`'s only remaining `projectCell` call site).

  Every remaining plain single-field call site (test files seeding `Vb`/`Vf`/`Fb`/`Ql`/`Qa`/`Qp`/
  env/signal fields with no provenance assertion of their own) was repointed at the matching RAW
  or `enter()`-routed named accessor, whichever the field already used. One test
  (`managedProject.test.ts`'s "relation-less fields are always Entered" block) tested an invariant
  that lives on `OpenISDProject` itself (`cell()`'s RELATIONLESS branch), not on anything
  `ManagedOpenISDProject`-specific, and needed `clear()` on arbitrary fields — which nothing in
  the app actually calls for these fields (grepped first) — so it was rewritten to exercise
  `OpenISDProject` directly instead of inventing a new public `ManagedOpenISDProject` method
  whose only caller would have been this one test.

  Verification: `grep -rn "\.projectCell(\|\.enterProjectField(\|\.clearProjectField("
  packages/ui/src packages/ui/test` — the only remaining hit is a string literal inside
  `architecture-project-symmetry.test.ts`'s detector-fixture demo (fake code proving the AST
  matcher works, not a real call). `packages/model`/`packages/ui` typecheck clean. 145 targeted
  tests pass (12 files: the 141 from the first pass plus `boxActiveSync.test.ts` and
  `architecture-project-symmetry.test.ts`, both newly exercised by this pass's call-site fixes).

- THIRD RULING (John, after reviewing `enterVentGroupField`/`clearVentGroupField`/
  `ventGroupFieldProvenance`/`enterPrGroupField`/`clearPrGroupField`/`prGroupFieldProvenance`):
  those six methods are STILL keyed dispatch — narrowing the key type from `ProjectFieldId` down
  to a 6-entry (or 2-entry) closed union changes nothing about the shape, only its size. "Unless
  all the accessors are flat methods on the project" — no keyed method survives on either domain
  class, full stop, not even one whose key type is provably safe. Where a caller needs to
  dispatch by a runtime field-id string, that `switch` belongs in the CALLING code, not as a
  method of the class being called — an ordinary function calling several of a class's public
  methods by name is not an encapsulation violation; a class method that takes a key and picks
  which of ITS OWN fields to touch is the pattern being retired here.

  IMPLEMENTED: deleted `enterVentGroupField`/`clearVentGroupField`/`ventGroupFieldProvenance`/
  `enterPrGroupField`/`clearPrGroupField`/`prGroupFieldProvenance` and their local
  `VentGroupField`/`VentGroupEntryField`/`PrGroupField` types from `managedProject.ts` entirely
  (`#projectCell`/`#enterProjectField`/`#clearProjectField`, now with no caller at all, were
  deleted too — not left as unreachable private dead code).

  Added, on BOTH `OpenISDProject` and `ManagedOpenISDProject`, a flat provenance-marking +
  solve-triggering `enter`/`clear` pair per vent/PR-group field (`enterBoxVolume_m3`/
  `clearBoxVolume_m3`, `enterBoxTuning_Fb_hz`/`clearBoxTuning_Fb_hz`, `enterVentDiameter_m`/
  `clearVentDiameter_m`, `enterVentLength_m`/`clearVentLength_m`, `enterVentWidth_m`,
  `enterVentHeight_m`, `enterPrFp_hz`/`clearPrFp_hz`, `enterPrAddedMass_kg`/
  `clearPrAddedMass_kg`), alongside a provenance-read method per field (`boxVolumeProvenance()`
  etc., returning `Provenance` directly). Each `OpenISDProject` method is a one-line delegate to
  the existing generic `enter(key, value)`/`clear(key)`/`cell(key).state` — the actual
  mark-and-solve logic was not duplicated, only given a name. Each `ManagedOpenISDProject`
  method mirrors the usual pattern: `this.mutate(p => p.enterX(value))` for writes,
  `this.#effective().project.X()` for reads. The pre-existing RAW pairs (`boxVolume_m3`/
  `setBoxVolume_m3` etc. — no provenance mark, no solve) are UNCHANGED and still needed for
  restore/seed writes, per the `prMadd` case `7746e2e`'s own commit message already established.

  `useVentGroup.ts`'s `enterVentField`/`clearVentField`/`ventFieldState` and `usePrGroup.ts`'s
  `enterPrField`/`clearPrField`/`prFieldState` now hold the field-id `switch` themselves,
  calling the flat method for each case, still wrapped in the same `suspendVentSolve()` as
  before. `architecture-project-symmetry.test.ts`'s prose (it names no method by AST match, only
  in comments/assertion messages) was updated to describe the flat methods instead of the
  deleted narrow-generic ones.

  Verification: `grep -rn "enterVentGroupField\|clearVentGroupField\|ventGroupFieldProvenance\|
  enterPrGroupField\|clearPrGroupField\|prGroupFieldProvenance" packages/ui/src packages/ui/test`
  — empty. `grep -rn "\.projectCell(\|\.enterProjectField(\|\.clearProjectField("
  packages/ui/src packages/ui/test` — same one harmless fixture-string hit as the second pass.
  `packages/model`/`packages/ui` typecheck clean (same pre-existing, unrelated `main.ts`/
  `App.vue` error). The same 145 tests across the same 12 files pass.

- **TARGET API DESIGN, superseding every flat-accessor listing above — NOT YET IMPLEMENTED.**
  John tore apart the fully-flat ~120-method design on real API-design grounds rather than
  accepting "flat = done": SRP violation (one class spanning driver/box/vent/PR/layer-management
  responsibilities with no type-level grouping, only comments); a real regression from the
  original `cell()` design (value and provenance split into two separate calls that can drift
  out of sync in a caller, instead of one `Cell<T>` carrying both); zero compiler-enforced
  completeness (adding a field means manually touching ~6 call sites by hand across two files,
  and this session's own review already found two real omissions this way — `isEntered`/
  `setEntered` missed entirely, an `alfaVC` naming collision); inconsistent boolean naming
  (`prChosen()` vs `isEntered()` vs `ventTargetUnreachable()`, three conventions, none picked
  deliberately); the coupled vent-group/PR-group relation being invisible in the API (nothing in
  the method names or types shows `Vb`/`Fb`/`ventD`/`ventL` are one Helmholtz relation, only a
  comment); and no single validation seam (100+ raw setters, no shared choke point).

  Resulting design:

  Every field below follows one of a small number of recurring method shapes. Documented once
  here rather than repeated per field — the semantics are identical everywhere the shape appears:

  - **`X(): Cell<T>` / `enterX(v: T): void` / `clearX(v: T): void`** — a field that's part of a
    SOLVED cross-field relation (e.g. `Vb`/`Fb`/vent dimensions are one Helmholtz relation).
    `X()` returns the current value AND whether it's user-Entered or solver-Calculated, in one
    call. `enterX(v)` sets the value AND marks it Entered, which re-runs the solver so every
    OTHER field in the relation updates to match. `clearX()` un-marks it Entered — the solver
    then re-derives it from whichever other field(s) in the relation ARE Entered.
  - **`X(): T` / `setX(v: T): void`** — a field with no cross-field relation, or a relation this
    specific field is deliberately excluded from (e.g. bandpass4's `frontVolume`). Plain read and
    raw write; no provenance to track, nothing else to re-solve.
  - **`X(): T`** with no setter — read-only, always solver-derived, never user-Entered (e.g.
    `resonance()` — WinISD's "Frc" — and `isChosen()`).
  - Re-solving an alignment's cross-field relation happens automatically inside `enterX()`/
    `clearX()` themselves (above) — the ONLY path that solves, and the ONLY path that writes.
    A project loaded from a FILE goes through `load(project: OpenISDProject)` instead — a
    real, already-solved domain object, not a raw payload — so there's nothing left to solve
    there either.

  ```typescript
  class OpenISDProject {
    readonly driver: {
      // every getter returns Cell<T> — value AND provenance together, one call.
      // No metaCell/cell split: that split was never a real domain boundary, only a
      // workaround for a monomorphic return type — every field just carries its own
      // concrete return type now (Cell<number> or Cell<string>).
      Fs(): Cell<number>; enterFs(v: number): void; clearFs(): void;
      // ...one triple per SpecSection field, and per metadata field (brand, model,
      // manufacturer, providedBy, comment, added) with Cell<string>.
    };

    // ONLY the topology selector and its per-alignment sub-shapes.
    //
    // Losses are NOT a box-level or even an alignment-level concept — BUG_20260824,
    // live-driven against real WinISD across all 6 box types (2026-08-24/25): the field
    // set is scoped per CHAMBER, and differs by whether that chamber has a port and/or
    // is coupled to another chamber. ONE `ChamberLosses` type cannot represent this — it
    // was the SAME mistake `rearVolume` already made, just moved into losses. Four
    // distinct loss-shape types instead, confirmed live:
    //   sealed / PR chamber (no port, no coupling)      -> SealedLosses      {Ql, Qa}
    //   plain vented chamber (port, no coupling)         -> VentedLosses      {Ql, Qa, Qp}
    //   bandpass4's rear (no port, coupled)               -> CoupledSealedLosses {Ql, Qa, Qicl}
    //   bandpass4's front / 6th-order's / ABC's chambers  -> CoupledVentedLosses {Ql, Qa, Qp, Qicl}
    // `Qicl` renders INSIDE each coupled chamber's own popup (confirmed on both sides of
    // bandpass4/6th-order/ABC), not as one shared box-level value — it does NOT live as
    // a bare method beside a chamber the way an earlier draft had it.
    readonly box: {
      boxType(): BoxType; setBoxType(kind: BoxType): void;

      // No public raw/bypass form anywhere below. The ONLY caller that legitimately
      // needs to write a value without triggering the solver is `loadUiParams()`
      // restoring a whole saved snapshot — that need is internal to the restore
      // implementation, not a capability every caller should have to reason about
      // ("why should anyone setting a value care whether something is being solved?"
      // — they shouldn't, so they aren't given the choice). `loadUiParams()` reaches
      // the raw write through `OpenISDProject`'s own private field, not through this
      // facade at all.
      // `vent` is nested under EACH alignment that has one, not top-level — needed for
      // the same reason volume/tuning are nested (a top-level `managedProject.vent`
      // would be silently meaningless while `sealed`/`passiveRadiator` is active). NOT
      // shared storage: an earlier draft of this comment claimed `vented` and
      // `bandpass4` reference the SAME live vent (true of the OLD flat model's
      // `activeVent(box)`, which reads "whichever alignment is active") — false here.
      // `OpenISDVentedAlignment`/`OpenISDBandpass4Alignment` each already carry their
      // OWN independent `vents` array in the real storage, same as `Ql`/`Qa`/`Qp` — each
      // alignment's vent is its own dormant-when-inactive field, not a shared pointer.
      readonly sealed: {
        // no cross-field relation exists for a sealed box — one write method, no
        // provenance split, since there is no "Calculated" alternative to protect.
        volume(): number; setVolume(v: number): void;
        resonance(): number;   // the resulting system Fc — calculated from volume + the
                                // driver's own Fs/Qts, same as bandpass4's rear chamber
        readonly losses: SealedLosses;
      };
      readonly vented: {
        volume(): Cell<number>; enterVolume(v: number): void; clearVolume(): void;
        // `tuning` is the TARGET frequency a person picks (e.g. "tune to 35 Hz") — entering
        // it drives the solver to compute the `vent`'s dimensions (diameter/length, or
        // width/height/length for a slot) that achieve it at the current `volume`. The
        // relation works the other way too: entering a vent dimension instead re-derives
        // `tuning` from whatever geometry was just set. Only one of `volume`/`tuning`/the
        // vent's own dimensions needs to be Entered at a time — the solver derives the rest.
        tuning(): Cell<number>; enterTuning(v: number): void; clearTuning(): void;
        readonly vent: VentApi;
        readonly losses: VentedLosses;
      };
      // Chambers and vents (ports) are two SEPARATE, sibling groupings — `chambers` and
      // `vents` — not one bundled into the other and not fully flattened either. A
      // chamber object that also carries its OWN `vent` field (tried, then reverted,
      // 2026-08-25) reads as "this chamber owns exactly one boundary port" — true for
      // `rear`/`front`, but ABC's third port doesn't belong to either chamber, it
      // CONNECTS them, and there's no chamber for it to nest inside. `chambers.rear`/
      // `chambers.front` below carry ONLY volume/tuning/losses — never a vent. Every
      // port for the box type, whatever chamber(s) it touches, is a flat sibling under
      // `vents` instead: `vents.rear`, `vents.front`, and (on `abc`) `vents.intra` — the
      // SAME three-way flat layout as the Vents tab itself
      // (`docs/winisd_screenshots/vents_tab_abc_three_ports.png`: "Rear chamber",
      // "Front chamber", "Intrachamber", no nesting between them there either).
      readonly bandpass4: {
        readonly chambers: {
          // rear = the chamber the driver protrudes into (this conversation's own
          // definition), SEALED — no port, so no `vents.rear`; a read-only calculated
          // `resonance()` (WinISD's "Frc") instead of a tuning to enter.
          readonly rear: {
            volume(): Cell<number>; enterVolume(v: number): void; clearVolume(): void;
            resonance(): number;
            readonly losses: CoupledSealedLosses;
          };
          // front = vented; its volume (`Vf`) has "exactly one home" (the original
          // real-code comment) — RAW, no Entered/Calculated distinction to protect,
          // unlike `tuning` which is still part of a solved relation.
          readonly front: {
            volume(): number; setVolume(v: number): void;
            tuning(): Cell<number>; enterTuning(v: number): void; clearTuning(): void;
            readonly losses: CoupledVentedLosses;
          };
        };
        readonly vents: {
          readonly front: VentApi;
        };
      };
      readonly bandpass6: {
        // UNLIKE bandpass4: BOTH chambers are vented and independently tunable —
        // confirmed live, "Tuning freq." renders as a live entry field on BOTH rear and
        // front (docs/winisd_screenshots/box_tab_bandpass6.png). No golden .wpr fixture
        // exists for this box type; built live via the New Project wizard for this probe
        // (WinISD's own wizard warns "can't calculate alignments for chosen box-type" —
        // no one-click alignment SUGGESTION exists, the box type itself still works).
        readonly chambers: {
          // each chamber's `tuning` is a TARGET frequency, same role as `box.vented`'s own
          // `tuning` above — entering it drives the solver to compute THAT chamber's own
          // `vents.rear`/`vents.front` dimensions to achieve it, and vice versa.
          readonly rear: {
            volume(): Cell<number>; enterVolume(v: number): void; clearVolume(): void;
            tuning(): Cell<number>; enterTuning(v: number): void; clearTuning(): void;
            readonly losses: CoupledVentedLosses;
          };
          readonly front: {
            volume(): Cell<number>; enterVolume(v: number): void; clearVolume(): void;
            tuning(): Cell<number>; enterTuning(v: number): void; clearTuning(): void;
            readonly losses: CoupledVentedLosses;
          };
        };
        readonly vents: {
          readonly rear: VentApi;
          readonly front: VentApi;
        };
      };
      readonly abc: {
        // RESOLVED, authoritatively (John, 2026-08-25): "Aperiodic BI-Chamber" — the
        // name itself says two. TWO chambers (rear, front — same shape as bandpass6's,
        // no vent nested in either), THREE ports: rear's own port to outside air,
        // front's own port to outside air, and a third port CONNECTING the two chambers
        // directly (`vents.intra`, the Vents tab's "Intrachamber" column) — a flat
        // sibling of `vents.rear`/`vents.front`, owned by neither chamber, matching how
        // it isn't itself a chamber either (no `chambers.intra`, no third air volume).
        // `intraLosses` stays outside `vents` — `VentApi` has no losses field for ANY
        // port, and `intraLosses`' exact shape is still open: a port CONNECTING two
        // chambers isn't itself an air volume the way rear/front are, so whether it has
        // a real `Qa` (absorption — a property of an enclosed volume) alongside
        // `Ql`/`Qp`/`Qicl` is unconfirmed; kept as `CoupledVentedLosses` as the best
        // current guess.
        readonly chambers: {
          // each chamber's `tuning` is a TARGET frequency, same role as `box.vented`'s own
          // `tuning` above — entering it drives the solver to compute THAT chamber's own
          // `vents.rear`/`vents.front` dimensions to achieve it, and vice versa. `vents.intra`
          // sits outside this relation entirely — it connects the chambers, it isn't tuned
          // toward either chamber's own target frequency.
          readonly rear: {
            volume(): Cell<number>; enterVolume(v: number): void; clearVolume(): void;
            tuning(): Cell<number>; enterTuning(v: number): void; clearTuning(): void;
            readonly losses: CoupledVentedLosses;
          };
          readonly front: {
            volume(): Cell<number>; enterVolume(v: number): void; clearVolume(): void;
            tuning(): Cell<number>; enterTuning(v: number): void; clearTuning(): void;
            readonly losses: CoupledVentedLosses;
          };
        };
        readonly vents: {
          readonly rear: VentApi;
          readonly front: VentApi;
          readonly intra: VentApi;
        };
        readonly intraLosses: CoupledVentedLosses;   // shape still unconfirmed
      };
      readonly passiveRadiator: {
        volume(): number; setVolume(v: number): void;   // no relation — plain
        tuning(): Cell<number>; enterTuning(v: number): void; clearTuning(): void;   // WinISD: Fp
        count(): number; setCount(v: number): void;      // no relation — plain
        addedMass(): Cell<number>; enterAddedMass(v: number): void; clearAddedMass(): void;
        readonly losses: SealedLosses;
        // configurePR(): selects/replaces which PR the box holds — NOT one-off, callable any
        // time the user changes their PR choice, exactly like `load(project)` can be called
        // any time the user changes their driver choice. `OpenISDDriver` already has a real
        // `section: 'woofer' | 'tweeter' | 'passive-radiator'` discriminator and its own
        // `'passive-radiator'` spec section (`openisdDriver.ts:218,556`) — a PR IS an
        // `OpenISDDriver`, the same purchasable-component concept a driver is, so it's stored
        // internally AS ONE, losslessly (`pr.section === 'passive-radiator'` enforced at
        // runtime), not copied into a narrower bespoke shape. That keeps the door open to
        // saving it back into My Drivers later, the same way a driver can be. `component`
        // below exposes only the narrow subset of that `OpenISDDriver` actually relevant to
        // the box's own calculations — the rest of its full spec stays present internally,
        // just not surfaced here.
        configurePR(pr: OpenISDDriver): void;
        // the COMPONENT's own intrinsics — nested here, not top-level, since nothing
        // outside the passive-radiator alignment ever touches OpenISDPassiveRadiatorRef
        // (unlike `vent`, this has no cross-alignment sharing to justify isolation).
        readonly component: {
          isChosen(): boolean;
          // The narrow subset of the underlying `OpenISDDriver` relevant to box calculations
          // — its OWN metadata fields (brand/model/manufacturer/providedBy/comment/added),
          // same shape as `driver` above, plus Sd/Mmd/Cms/Rms/Xmax.
          brand(): Cell<string>; enterBrand(v: string): void; clearBrand(): void;
          model(): Cell<string>; enterModel(v: string): void; clearModel(): void;
          manufacturer(): Cell<string>; enterManufacturer(v: string): void; clearManufacturer(): void;
          providedBy(): Cell<string>; enterProvidedBy(v: string): void; clearProvidedBy(): void;
          comment(): Cell<string>; enterComment(v: string): void; clearComment(): void;
          added(): Cell<string>; enterAdded(v: string): void; clearAdded(): void;
          Sd(): Cell<number>; enterSd(v: number): void; clearSd(): void;
          Mmd(): Cell<number>; enterMmd(v: number): void; clearMmd(): void;
          Cms(): Cell<number>; enterCms(v: number): void; clearCms(): void;
          Rms(): Cell<number>; enterRms(v: number): void; clearRms(): void;
          Xmax(): Cell<number>; enterXmax(v: number): void; clearXmax(): void;
        };
      };
    };

    // Every field method above is a real method on THIS class — no generic passthrough.
    // No layer management here: ground/committed/overlay, Cancel, Reset, and subscription
    // are `ManagedProject`'s job, a separate wrapper below — `OpenISDProject` is a plain
    // domain object, the same one `ManagedProject` holds up to three independent copies of.
    copy(): OpenISDProject;   // real code: `openisdProject.ts`'s own `copy()` — how
                              // `ManagedProject` obtains each layer's independent instance.
  }

  // `ManagedProject` — the layer-management wrapper. Holds ground/committed/overlay, each an
  // independent `OpenISDProject`, and delegates field reads/writes to whichever is effective
  // (`driver`/`box` here are the SAME sub-objects `OpenISDProject` declares above — reached
  // through whichever layer is active, not redeclared). Real code: `export class
  // ManagedProject` (`managedProject.ts:98`).
  interface ManagedProject {
    readonly driver: OpenISDProject['driver'];
    readonly box: OpenISDProject['box'];

    // No snapshot(): OpenISDProject. Checked against real usage: it's the escape hatch this
    // whole design exists to close — `packages/ui/test` calls it constantly to reach fields
    // directly (`mp.snapshot().cell('Vb').value`, `.tuning_Fb_hz()`, `.ventDiameter_m()`...),
    // bypassing every named accessor above. As a PUBLIC method nothing stops a UI caller
    // doing the same. `load(project: OpenISDProject)` stays — its one real caller
    // (`appState.ts:636`) receives `project` from `@openisd/persistence`'s `projectRepo.ts`,
    // a repo boundary — domain object flowing between SIBLINGS, the pattern this doc's own
    // opening sanctions ("the repo exposes the domain object on its API"), not the app
    // reaching into internals.
    beginWhatIf(): void; cancelWhatIf(): void; resetOverlayToGround(): void; isWhatIfActive(): boolean;
    load(project: OpenISDProject): void; loadEmpty(): void;
    subscribe(fn: () => void): () => void;
  }

  // 'bandpass6' and 'abc' added 2026-08-25 once BUG_20260824's live probe confirmed both
  // are real, working box types in WinISD (its wizard warns no one-click alignment
  // SUGGESTION exists for either, not that the box type itself doesn't work). `abc`'s
  // sub-object above still has one unconfirmed piece (intraLosses' exact shape).
  type BoxType = 'sealed' | 'vented' | 'bandpass4' | 'bandpass6' | 'passive-radiator' | 'abc';

  type VentShape = 'round' | 'slotted';

  interface VentApi {
    shape(): VentShape; setShape(v: VentShape): void;
    diameter(): Cell<number>; enterDiameter(v: number): void; clearDiameter(): void;
    width(): Cell<number>; enterWidth(v: number): void; clearWidth(): void;
    height(): Cell<number>; enterHeight(v: number): void; clearHeight(): void;
    length(): Cell<number>; enterLength(v: number): void; clearLength(): void;
    endCorrection(): number; setEndCorrection(v: number): void;
    area_m2(): number;
    effectiveLength_m(): number;
  }

  // Four distinct loss shapes, live-confirmed (BUG_20260824) — no port -> no Qp; no
  // coupling to another chamber -> no Qicl. Every field RAW (no relation, per the
  // official WinISD help text's own three-item list — Qicl is WinISD's own addition on
  // top of that for coupled chambers, not part of the documented three).
  interface SealedLosses {
    Ql(): number; setQl(v: number): void;
    Qa(): number; setQa(v: number): void;
  }
  interface VentedLosses {
    Ql(): number; setQl(v: number): void;
    Qa(): number; setQa(v: number): void;
    Qp(): number; setQp(v: number): void;
  }
  interface CoupledSealedLosses {
    Ql(): number; setQl(v: number): void;
    Qa(): number; setQa(v: number): void;
    Qicl(): number; setQicl(v: number): void;
  }
  interface CoupledVentedLosses {
    Ql(): number; setQl(v: number): void;
    Qa(): number; setQa(v: number): void;
    Qp(): number; setQp(v: number): void;
    Qicl(): number; setQicl(v: number): void;
  }

  // No BoxSnapshot/LossesSnapshot/DriverSnapshot/RestSnapshot — removed entirely (2026-08-25),
  // not just relocated. Checked against the real code: neither Cancel/Reset (see `restore()`'s
  // removal note above the class) nor switching between several open project tabs needs a
  // serialized payload. Tab-switching is a plain list-plus-index problem —
  // `openProjects(): ManagedProject[]` (real code, `appState.ts:89`) plus which index is
  // active; each open tab already has its OWN live `ManagedProject`, so switching tabs
  // is picking a different element, not serializing one instance's state out and another's back
  // in. The real code's JSON-string `groundCheckpoint()`/`restoreGroundCheckpoint()` mechanism
  // is not a pattern this design reproduces.
  ```

  Zero generics, zero `keyof`, zero field-id parameters anywhere — every field individually
  named, every getter carrying its own concrete return type. Sub-object nesting (`driver`,
  `box`, and per-alignment inside it — `box.sealed`/`box.vented`/`box.bandpass4`/
  `box.passiveRadiator`, with `vent`/`component` nested one level deeper only where the
  alignment actually has one) keeps single-responsibility intact instead of flattening ~120
  methods onto one class, and — critically — makes it structurally impossible to call a
  method that's meaningless for the current box type (there is no top-level `vent`/`pr` a
  caller could reach while `sealed` is active; you can only get to `VentApi` through
  `box.vented`/`box.bandpass4`).

  Costs, stated explicitly rather than hidden: still ~120+ individual methods total (now
  organized under nested namespaces instead of 1 flat list). Still zero compiler-enforced completeness
  when a field is added to `SpecSection`/`OpenISDVent`/`OpenISDPassiveRadiatorRef` — each
  sub-object's method set is manual, not derived via `keyof`, so nothing catches a forgotten
  method the way a keyed accessor's exhaustive `switch` would. Still no single validation seam —
  100+ raw setters means 100+ places bounds-checking could be applied inconsistently or omitted.
  Namespacing fixes discoverability and cohesion; it does not fix extensibility or validation,
  and those two costs are the explicit, accepted price of "zero generic accessors, full stop."

- **DRIVER EDITOR ACROSS BOTH ORIGINS — `ManagedDriver` and the editor adapter (2026-08-25).**
  The driver editor has to work on a driver that came from My Drivers/the bundle OR on the one
  embedded in the open project, and those two are NOT the same thing underneath: an embedded
  driver's json is owned by the project (only the project decides when it clones), a standalone
  one has no owner at all.

  **`detach(): OpenISDDriver` — not a class split.** An earlier draft of this reached for
  `OpenISDDriverStandalone`/`OpenISDDriverEmbedded` subclasses. Rejected: the difference isn't
  "some drivers can copy themselves and some can't", it's "copying is what MAKES one
  independent" — one method on the one class, available everywhere:
  `detach()` returns `OpenISDDriver.wrap({ ...this.#get() })`. It hands back another
  `OpenISDDriver` — never the raw `OpenISDDriverJson`, so the file header's own ban on leaking
  the internal shape holds — and being a method it reaches `#get()` the way any other method
  does, exposing nothing new.

  **Editing a standalone driver in place is a BUG, not a shortcut.** A first pass had the
  editor write straight onto the `OpenISDDriver` it was handed, with "Cancel = drop the
  reference." That does not undo anything: `enter()`/`clear()` mutate that instance's closure
  state immediately, so Cancel leaves the edits in place, and anything else holding the same
  instance (a My Drivers list preview) shows in-progress unsaved edits as you type. Standalone
  editing needs the same edit-a-working-copy discipline the project case gets from
  `beginEdit()`.

  **`ManagedDriver` — the edit layer only, no independent ground.** It does NOT reproduce
  `ManagedProject`'s ground/committed tiers; it comes into existence already IN an edit state,
  two ways:
  - *from a project*: `managedProject.beginEdit()`, then wrap that edit layer's driver. A thin
    adapter over the project's existing machinery, not a second state-holder. `commit()` →
    `managedProject.commit()`; `cancel()` → `managedProject.cancelTransient()`.
  - *from standalone* (My Drivers, or a bundle entry `detach()`ed on open): clone the driver;
    that clone IS the edit state. `commit()` writes the edited state back to the underlying
    driver; `cancel()` discards the clone.

  **The editor binds to an adapter, never to `OpenISDDriver` directly.** `save`/`cancel` are
  UI-workflow semantics, not domain-object semantics, and they route to structurally different
  places per origin — so they cannot live on `OpenISDDriver`, which has to stay usable in both
  contexts without knowing which one it is in:

  ```typescript
  interface OpenISDDriverEditor {
    readonly driver: OpenISDDriver;   // the field surface the UI binds to
    save(): void;
    cancel(): void;
  }
  ```

  Two implementations (project-backed, standalone-backed); the editor component only ever sees
  this interface and never branches on origin.

  **Scenario-by-scenario, as ruled:**
  - Editing the project's embedded driver — editing it IS editing the project. `beginEdit()`
    first, editor gets the edit layer's driver.
  - "Save to My Drivers" from inside that session — `detach()`, then stash the detached copy.
    The project's own driver is untouched.
  - Opening a BUNDLE driver in the editor — `detach()` immediately, before the UI opens
    (mandatory, silent). Stashing to My Drivers stays a separate EXPLICIT Save, not automatic
    on open — otherwise every bundled driver anyone glanced at would land in My Drivers.
  - Opening a MY DRIVERS entry — `wrap()` it; Save means update that same entry.
  - "Save as a new copy" while editing an existing My Drivers entry — `detach()`, same as the
    bundle case, so the fork shares no storage with the original.

  **UNRESOLVED — what `commit()` means for the standalone case.** `OpenISDDriver`'s storage is
  private, so nothing outside the class can write into an EXISTING instance. Either (a)
  `adopt(edited: OpenISDDriver): void` mutates in place so other references to the original see
  the update — but needs a cross-instance json read, re-opening the leak question `detach()`
  already answers cleanly; or (b) `commit()` returns the finalized driver for the caller to
  persist (`myDriversRepo.save(managedDriver.commit())`), where "updates the underlying driver"
  means the storage slot, not a live in-memory object — simpler, no new primitive, but changes
  `commit()`'s signature from `void`. Not yet decided.

- **THREE CORRECTIONS to the driver-editor entry above (John, 2026-08-25).**

  **`draftDriver(shallowRef(markRaw(...)))` — the current implementation's approach — is
  rejected.** That is a detached scratch object living in the COMPONENT, which puts edit state
  in the UI layer where it does not belong. The editor edits the adapter it was handed, and
  nothing else; the adapter owns the staging. This also settles "who owns the draft" — always
  the adapter, never a `ref` inside a Vue component.

  **`ManagedDriver` is NOT edit-layer-only — it depends on what it wraps.** The entry above
  over-generalized from the standalone case. Both cases have two states; what differs is where
  they live:
  - wrapping a PROJECT: `ManagedProject` already has committed and edit tiers, so the adapter
    surfaces both — it routes to layers that genuinely exist underneath.
  - wrapping a STANDALONE driver: the clone is the edit state and the original driver is the
    committed state — same two states, one inside the adapter and one outside it.

  **ONE adapter, not two types.** `ManagedDriver` and `OpenISDDriverEditor` as separately
  proposed were the same thing described twice — one holding edit state, the other exposing
  save/cancel over that same edit state. Collapsed: a single `ManagedDriver` carrying `driver`
  (the field surface the UI binds to), `commit()` and `cancel()`, with two constructors
  (from-project, from-standalone) that route those two methods to their respective backings.
  No separate editor-adapter layer, and no `OpenISDDriverEditor` interface.
