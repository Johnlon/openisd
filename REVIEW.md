# Kill all global symbols except `openProjects()`/`focusedProject()`

## Status at a glance

**Decided (yours to change, mine to implement):**
- Only two module-level globals are legal anywhere: `openProjects(): ManagedOpenISDProject[]`,
  `focusedProject(): ManagedOpenISDProject | null` — zero or more projects open, not always one.
- `ManagedProject` → renamed to **`ManagedOpenISDProject`**.
- Model-package `OpenISDProject` (plain interface) → renamed to **`_OpenISDProjectJson`**,
  same private-record convention as `_OpenISDDriverJson`.
- `packages/ui/src/logic/model/OpenISDProject.ts` (the redundant duplicate class, its own
  ground/modified/transient layering) is **deleted**.
- `Layer` (the `{project, driver}` struct in `managedProject.ts`) has **no surviving
  justification** — collapses to `project: OpenISDProject` alone, no live `driver` field.
- `OpenISDDriver.clear()` becomes **unconditional `delete specs[field]`** — no restore of a
  displaced reading. `#displaced` is deleted entirely. Recorded in `BACKLOG.md`.
- The edit-draft lifecycle (`beginEdit`/`commitEdit`/`cancelEdit`/`isEditActive`) **dies** —
  never called from the app, `clear()` is the only undo that exists or will exist. Recorded in
  `bugs/BUG_20260818_managedproject_edit_draft_lifecycle_is_fully_built_but_never_called_from_the_app.md`.

**RULED (human, 2026-08-18) — items 1-5 below decided:**
1. **`ManagedOpenISDProject` holds `_OpenISDProjectJson` ONLY via an `OpenISDProject` class**
   (mirroring `OpenISDDriver`/`_OpenISDDriverJson`) — never the raw record directly. The new
   class's own encapsulation must not be broken: same discipline as `_OpenISDDriverJson` (owner
   file + explicit `PrivateAllow` list only). Design of that class's public API is NOT yet
   done — see "where this gets stuck" below.
2. `workspace.ts` — **delete if possible, subsume otherwise.** Reducing code is good as long as
   architecture isn't compromised by it — prefer deletion, fall back to rewiring only where a
   real capability would otherwise be lost.
3. `types.ts`'s 17-shape grab-bag — **split now, in this plan.** Ruled a liability; its contents
   move to better-owned homes as part of this work, not deferred.
4. `openProjects()`/`focusedProject()` — **plain functions.** Not Vue computed refs — no reason
   the UI framework should be involved in what these fundamentally are.
5. `OpenISDPassiveRadiatorRef`/PR-shape duplication — confirmed out of scope, raised separately
   after this plan lands.
7. `Driver extends DriverRaw` — **largely superseded by item 8's `CircuitSolverParams` ruling
   below (simple class, no inheritance) — kept here for the field-truth analysis, which item 8's
   design pass still needs.** Retracted an earlier overclaim here (2026-08-18); genuinely
   unresolved, not a simple drop-the-extends rename. `DriverRaw` is marked OBSOLETE by its own
   comment (AD-9: "Do NOT add fields to it or build new consumers of it"), and `Driver` is a
   live consumer of it — but checking only `deriveDriver`'s SIGNATURE (`(d: DriverRaw):
   Result<Driver>`) missed that its BODY genuinely depends on the inheritance: it reads/writes
   `Dd`, `Pe`, `Xmax`, `no` on a `Driver`-typed working value (`driver.ts:363+`, `Object.assign
   ({}, d) as Driver`) — none of those 4 fields are among `Driver`'s own 11 declared fields;
   they exist only because `DriverRaw` declares them. Separately, `Pe`/`Xmax` are declared
   required on `Driver` but the code treats them as genuinely optional (`r.Pe! > 0`,
   `r.Xmax! > 0` — non-null assertions used because derivation proceeds, with only a warning,
   when either is absent) — the declared type doesn't match what the code actually guarantees.
   Real scope: (a) work out the TRUE required-vs-optional field set from what `deriveDriver`
   actually reads/writes/guarantees, not from what's currently declared; (b) decide whether
   `Dd`/`no` belong in `Driver`'s own declared shape (they're clearly part of its real output);
   (c) only then decide whether `extends DriverRaw` can safely go. Bigger and riskier than
   item #6's pure rename — needs its own investigation pass before any code changes here.

8. **RULED (human, 2026-08-18): delete `Driver` (engine package) entirely, replaced by a class +
   adapter, not an interface with `extends`.** Real, load-bearing consumer list, verified — 13
   files use it as a type: `deriveDriver`/`withAddedMass` (`engine/driver.ts`), `sweep`/
   `maxCurves` (`engine/sweep.ts`), `circuit.solve` (`engine/circuit.ts`), `alignments.ts`,
   `computeEbp` (`ui/logic/driverFigures.ts`), `seriesFor` (`ui/logic/series.ts`), the `.wpr`
   writer (`ui/logic/wprMapping.ts`), `store.ts`'s `driver` export, `types.ts`'s `Design.driver`.

   **RULED (human, 2026-08-18): no inheritance — classes and adapter patterns instead.** Applies
   to this replacement and generally: `interface X extends Y` is not the fix for "narrow Y's
   optional fields to required." The replacement is a class that takes a validated `DriverRaw`
   and exposes the guaranteed-populated fields as its own properties/methods — an adapter over
   the raw input, not a type-level `extends`.

   **SUPERSEDED naming — final ruling (human, 2026-08-18): `CircuitSolverParams`, not
   `FullySpecifiedDriver`.** Investigating actual usage found `Driver` is consumed by TWO real
   things — the chart pipeline (`sweep`/`maxCurves`/`circuit.solve`) AND the `.wpr` file export
   (`wprMapping.ts`, via `driver.Re` and `sealedFc(driver, P.Vb)`) — plus one declared-but-dead
   consumer (`computeEbp`, zero callers anywhere in `packages/ui/src`/`test`, checked directly).
   **Ruled: the type becomes PURELY the circuit solver's input, nothing else** — `CircuitSolverParams`
   is the correct name because it's the correct SCOPE, not just a label.

   **RULED (human, 2026-08-18): `CircuitSolverParams`'s sole purpose is to provide exactly the
   inputs the circuit solver needs — zero other approved use cases.** A simple class of
   properties satisfying that need, no more. Not a general-purpose "resolved driver" type
   reachable from anywhere — if a future call site wants driver values for something other than
   feeding `sweep`/`maxCurves`/`circuit.solve`/`withAddedMass`, it does NOT reach for this class.
   Consequences:
   - `sealedFc` is decoupled entirely — takes `(Fs: number, Vas: number, Vb: number): number |
     null` instead of `(drv: Pick<Driver, 'Fs'|'Vas'>, Vb: number)`. No driver-shaped type at
     all; every caller passes plain numbers. `wprMapping.ts`'s call site updates accordingly.
   - `wprMapping.ts`'s other use (`driver.Re` for the impedance-peak lookup) needs its own
     resolution — either take `Re: number` directly (same decoupling as `sealedFc`), or read it
     off `_OpenISDDriverJson`/`OpenISDDriver` directly since `.wpr` export is a UI/model-layer
     concern, not the circuit solver's. **SUPERSEDED (human, 2026-08-18) — wrong problem, solved
     at the wrong level.** `buildWprInput`'s whole 7-parameter signature (`box, P, driver,
     driverSection, project, now, curves`) is the anti-pattern, not just its `driver` param.
     The `.wdr` writer already does this correctly — `exportDriver(driver: OpenISDDriver):
     Result<string>` (`winIsdDriverFileIo.ts:34`) takes the ONE live domain object and derives
     everything internally (`driver.toRecord()`, `driver.ebp()`) via `WinISDDriver
     .fromOpenISDRecord(...)`. **Ruled: `buildWprInput` is rewritten to the same pattern —
     takes the single `ManagedOpenISDProject` (once renamed) and derives `box`/`P`/`driver`/
     `project`/`curves` internally**, not 7 loose caller-assembled parameters. Not a deletion —
     a signature rewrite matching the `.wdr` precedent exactly. Not yet scoped: the concrete
     shape of the `.wpr`-side equivalent to `WinISDDriver.fromOpenISDDriver()` (e.g. does the
     whole `buildWprInput`/`toWpr()` chain become a `WinISDDriver.fromOpenISDProject()`/similar
     static factory, mirroring the driver-export path one level up).

     **RULED (human, 2026-08-18): no inline calc arithmetic in the mapping code either —
     these become calc properties/methods on `ManagedOpenISDProject` or its constituent API.**
     Found while reviewing this file: `const Sp = Math.PI * (P.ventD / 2) ** 2;` (`wprMapping.ts:
     42`) is inline physics arithmetic, directly contradicting the file's own header comment
     ("Pure glue only... no physics is re-derived here") — and the SAME formula is independently
     duplicated in 3 more files (`OriginalShell.vue:147`, `useVentGroup.ts:49`, `store.ts:383`),
     with no shared engine function anywhere. Recorded as its own bug:
     `bugs/BUG_20260818_vent_area_formula_duplicated_four_times_no_engine_source_of_truth.md`.
     Ruling: `Sp`/vent-area and similar box/vent-derived quantities become properties/methods
     the caller reads off `ManagedOpenISDProject` (or whatever it composes), not arithmetic
     written inline at each of N consumers. Applies generally to this rewrite, not only `Sp` —
     `buildWprInput`'s body has several more inline derivations (`sealedFr` selection logic,
     `Ff`/`tuningFromLength` calls) that should be re-examined against the same rule once the
     `ManagedOpenISDProject`-based signature lands.
   - `computeEbp` (dead) — either deleted outright (it's unused), or if kept, takes whatever
     `wprMapping.ts` ends up taking, not `CircuitSolverParams`.
   - `CircuitSolverParams` stays engine-owned (package-local) — engine has zero dependencies
     today (`packages/engine/package.json` has no `dependencies`, confirmed, no file imports
     `@openisd/model`) and stays that way. Nothing outside `sweep`/`maxCurves`/`circuit.solve`/
     `withAddedMass`/`alignments.ts` receives a `CircuitSolverParams` instance.
   - `deriveDriver(d: DriverRaw)` becomes the adapter/factory —
     `CircuitSolverParams.from(d): Result<CircuitSolverParams>` — validates and returns an
     instance, never a cast of a possibly-incomplete object to a type claiming completeness
     (`circuit.ts`'s reads of `Cms`/`Sd`/`Mms`/`Rms`/`Bl`/`Re` are unguarded — an incomplete
     object wrongly typed as complete produces silent `NaN` propagation through the whole sweep,
     not an error). Fixes item #7's Pe/Xmax/Dd/no findings in the same pass (`Pe`/`Xmax` likely
     become genuinely optional properties/methods, not required ones; `Dd`/`no` become real
     declared properties instead of borrowed from `DriverRaw`).
   Not yet scoped in detail — needs its own design pass before touching call sites.

**Blockers — bugs found during this review, all must be fixed (human ruling, 2026-08-18):**
these are not side findings to defer — they block sorting out this app's architecture and are
treated as required work, not optional follow-ons. None fixed yet; all recorded per bug-first
rule, awaiting implementation.

1. `bugs/BUG_20260818_coaxial_driver_type_still_locks_openisddriver_to_the_woofer_section_only.md`
   — `driver_type: 'coaxial'` silently collapses to the `woofer` section; `_Specs` already
   supports both `woofer` and `tweeter` simultaneously, `OpenISDDriver` never exposes the second.
2. `bugs/BUG_20260818_managedproject_edit_draft_lifecycle_is_fully_built_but_never_called_from_the_app.md`
   — `beginEdit`/`commitEdit`/`cancelEdit`/`isEditActive` fully built, unit-tested, zero call
   sites in the app. Ruled dead — delete outright (see Decided list above).
3. `bugs/BUG_20260818_vent_area_formula_duplicated_four_times_no_engine_source_of_truth.md` —
   `π·(ventD/2)²` computed inline in 4 separate files, no shared engine function; `wprMapping.ts`
   contradicts its own "no physics re-derived here" header comment doing it. **Generalized
   principle (human, 2026-08-18): the fix is not merely "dedupe into a shared engine function" —
   the formula's result must be exposed ONLY as a getter method on the owning domain class
   (`ManagedOpenISDProject`'s API), never called ad hoc as a free function from UI logic. Same
   rule applies to blocker #6.**
4. `bugs/BUG_20260818_fromOpenISDRecord_does_not_exist_9_call_sites_broken.md` — 9 call sites
   (including `winisdDriver.ts`'s own internal self-call) reference a method that was renamed at
   its declaration but never updated at any call site; `packages/winisd` currently fails to
   typecheck on this. **Subsumed by QO55** (questions.yml, open since 2026-08-17) — not a narrow
   rename-the-call-sites fix; the target method (`fromOpenISDDriver`) itself still calls
   `driver.toRecord()` internally, which is separately, absolutely forbidden (blocker #5).
5. **QO55** (`questions.yml`, open) — `WinISDDriver` must be constructed purely by setter calls
   fed from `OpenISDDriver` getter reads; zero internal derivation, zero `.toRecord()`/raw-JSON
   access anywhere in `packages/winisd/src/winisdDriver.ts`. Confirmed 2026-08-18: the JSON
   record is confidential, off-limits outside its owner, full stop — not merely "logic doesn't
   belong here." This is the largest of the five — a real rewrite of `WinISDDriver`'s
   construction, not a patch, and blocker #4 cannot be fixed correctly without it. **Reconfirmed
   again (human, 2026-08-18): `packages/winisd` is PURELY a transfer class — zero logic, zero
   calcs, a structural transform from OpenISD's shape to the WinISD file format, nothing else.**
6. `bugs/BUG_20260818_pr_formulas_and_air_constants_duplicated_outside_engine.md` — 3 PR T/S
   formulas (Mmd-from-Fs/Cms, Rms-from-Mmd/Cms/Qms, Cms-from-Vas/Sd) duplicated 3-5× each across
   `prWinIsdFields.ts`/`useDesignIO.ts`, same class of violation as blocker #3. Worse:
   `useDesignIO.ts:242-243` re-declares `RHO`/`C` locally, **truncated** (`1.20095`/`343.68`)
   instead of importing the engine's full-precision values (`constants.ts:19-20`) — a real
   numeric-drift risk between `useDesignIO.ts`'s computations and everything else in the app.
7. **New `_OpenISDDriverJson`-encapsulation violators found in a follow-up sweep, not previously
   counted:** `DriverEditorModal.vue` calls `.toRecord()` on a live `OpenISDDriver` 4 times
   (lines 69, 340, 346, 394) — reading a field for display, persisting to My Drivers storage,
   and passing raw JSON out through the driver-selection accept callback twice. `openisdYaml.ts:
   31` also calls `.toRecord()` and is not on `_OpenISDDriverJsonPrivateAllow` — a genuinely new
   offender, not one of the 7 already tracked by today's architecture test. Neither fixed; both
   are additional entries for whatever resolves the existing `_OpenISDDriverJson` violation list.

**Not started:** no code has been touched for this plan. Phase 0 (the enforcement test) hasn't
been written yet.

---

## Ruling and context

Human ruling (QO52, closed 2026-08-18): it is illegal for `packages/ui/src/logic/store.ts` — or
any module — to export a global symbol other than the two permitted globals above. Everything
else in `store.ts`'s current ~40-export surface (`state`, `managedProject`, `driver`,
`driverRecord`, `isModified`, `enterVentField`, `formatInUnit`, ...) is a violation and must
become a method/getter on the focused project object instead of a free module export. This
mirrors the `_OpenISDDriverJson`/`PrivateAllow` mechanism already landed
(`packages/ui/test/ui/architecture.test.ts`) — same governance: only the human may grant an
exemption; an agent may never widen an allowlist to make a red test pass.

Scoping this surfaced a live design collision: **three separate "one project's state"
implementations** existed — `ManagedProject` (the real facade), a plain-data `OpenISDProject`
(model package, what `ManagedProject` wraps three copies of), and a second, independent
`OpenISDProject` *class* (`packages/ui/src/logic/model/OpenISDProject.ts`) with its own
ground/modified/transient layering, wired to `workspace.ts` instead of `ManagedProject`. Two
independent, disconnected state machines both answering "has this project changed since it was
saved" — not a naming accident, a real divergence risk. Resolved per the Decided list above.

**Zero-or-more, not always-one.** The app does not "instantiate a project" — the user opens
projects. `openProjects()` is `[]` when nothing is open; `focusedProject()` is `null` in that
state, and the UI's project list is what tells the user to open one. Every `focusedProject()`
call site in Phases 2–4 must treat null/empty as a real, reachable state, not a startup-only
edge case papered over with a default project.

---

## Open decisions — detail

### 1. Does `ManagedOpenISDProject` need a per-layer `OpenISDProject` class?

`OpenISDDriver` (class) wraps exactly ONE `_OpenISDDriverJson`, 1:1. `ManagedProject` does NOT
mirror that — there is no `OpenISDProject` class in the model package, only a plain interface;
`ManagedProject` holds 3 copies of that plain data directly (`Layer.project: OpenISDProject`).
Question: should this migration introduce an `OpenISDProject` class (wrapping
`_OpenISDProjectJson`, one instance per layer), or does `ManagedOpenISDProject` keep holding
plain `_OpenISDProjectJson` directly, as today? Changes Phase 1's scope (new class vs. pure
rename). **Note:** the original argument for this symmetry (mirroring `Layer.driver` as a live
wrapper) no longer applies — see `Layer` in the Decided list; that justification is dead.

### 2. `workspace.ts`'s fate

`WorkspaceEntry`/`WorkspaceSnapshot`/`OpenProject` exist only as the deleted duplicate class's
supporting cast. Once `openProjects()`/`focusedProject()` exist, does `workspace.ts` survive as
a separate persistence layer rewired onto `ManagedOpenISDProject`, or is it subsumed entirely
(`WorkspaceSnapshot` looks like exactly what persisting `openProjects()` needs to do)?

### 3. `types.ts` split

17 unrelated shapes (`AppState`, `SerializedState`, `ProjectMeta`, `PRLibEntry`, `BundledPR`,
`DriverJSON`, `Design`, `UiParams`, ...) live in one grab-bag file. It's the real root cause of
both duplications found (`ProjectMeta` vs. `OpenISDProjectMeta`, the two `OpenISDProject`s) —
every duplication has one shape in the file that owns the concept and a second shape dumped in
`types.ts`. Splitting it is real cleanup, but roughly doubles this plan's blast radius — my
recommendation is a separate follow-on, not folded in here.

### 4. Calling convention

Plain functions (`openProjects()`) vs. Vue computed refs — needs confirming before Phase 2 is
written, changes every call site.

### 5. PR-shape duplication (out of scope, flagged only)

`OpenISDPassiveRadiatorRef`/`Alignment` (model, canonical, but `Ref` is self-marked as a
placeholder) plus four ui-layer flat-field PR shapes (`PRLibEntry`, `BundledPR`,
`PrDatasheetInput`, `PrCanonical`) in legacy WinISD vocabulary — structurally the same pattern
the driver model solved, unaddressed for PR. Recommend its own ledger question once this plan
lands.

---

## Findings discovered during review (not part of the global-symbols plan itself)

Deep-diving `Layer`/`#displaced` while scoping Phase 3 surfaced two real, separately-recorded
issues:

- **`bugs/BUG_20260818_coaxial_driver_type_still_locks_openisddriver_to_the_woofer_section_only.md`**
  — `driver_type: 'coaxial'` silently collapses to the `woofer` section; the record already
  supports both `woofer` and `tweeter` sections simultaneously, `OpenISDDriver` doesn't expose
  the second one. Not fixed, needs a design decision.
- **`bugs/BUG_20260818_managedproject_edit_draft_lifecycle_is_fully_built_but_never_called_from_the_app.md`**
  — `beginEdit()`/`commitEdit()`/`cancelEdit()` fully implemented and unit-tested, zero call
  sites in `packages/ui/src`. Ruled dead 2026-08-18, deletion listed in the bug file's Fix
  section, not yet applied.
- **`BACKLOG.md` "Driver data & T/S"** — `clear()`'s unconditional-delete rewrite, cross-
  referencing the above.

---

## Task breakdown

Ordered so each numbered task is either independently landable, or clearly blocked on a named
earlier one. Design tasks (D-series) produce a draft for your review before their dependent
implementation tasks start — they are NOT rubber-stamped by me alone, per the "where would you
get stuck" list above.

### Phase B — fix the 7 blockers (independent of everything else; can start immediately)

- **B1.** Coax driver-section bug — stays on `BACKLOG.md`/bugs, explicitly NOT blocking (your
  ruling). No task here.
- **B2. DONE (2026-08-18).** Edit-draft lifecycle deleted (`beginEdit`/`commitEdit`/
  `cancelEdit`/`isEditActive`, the `Overlay` type's `'edit'` variant, `managedProject.ts` and
  `store.ts` doc comments, `managedProject.test.ts`'s covering tests removed/rewritten). Full
  suite for the touched files verified green (`managedProject.test.ts`, `openisdDriver.test.ts`,
  `persist.test.ts` — 34/34 pass).
- **B3. DONE (2026-08-18).** `OpenISDDriver.clear()` rewritten to unconditional
  `delete specs[field]`; `#displaced` deleted; `enter()`'s write to it removed. Note: left
  `#displacedMeta`/`clearMeta()` (the metadata-field equivalent) untouched — the ruling was
  specific to `clear()`/`_SpecEntry`, not `clearMeta()`/`_ScrapedField`, and extending it wasn't
  discussed; flag if that should change too.
- **B4.** Vent-area formula (`π·(ventD/2)²`) — per the getter-only ruling, this needs **D1**
  (below) done first, since the destination is a getter on the domain class, not a bare engine
  function. Blocked on D1.
- **B5.** PR formulas + `RHO`/`C` duplication — same as B4, blocked on D1 (or D3 if the PR state
  ends up owned by `CircuitSolverParams`'s domain instead — resolve during D1/D3).
- **B6.** `fromOpenISDRecord` 9 broken call sites — do NOT fix narrowly (repoint to
  `fromOpenISDDriver`); this is subsumed by **B7**.
- **B7. = QO55.** Rewrite `WinISDDriver`'s construction as pure getter-read/setter-write, zero
  internal derivation, zero `.toRecord()`/raw-JSON access anywhere in `winisdDriver.ts`. Largest
  blocker; needs its own design pass (what does `OpenISDDriver`'s getter surface need to expose
  for every WinISD-format field, value + E/C/N state) before implementation. Not yet started.
- **B8.** New `_OpenISDDriverJson` encapsulation violators (`DriverEditorModal.vue` ×4,
  `openisdYaml.ts`) — add to whatever remediates the existing 7-file violation list; no new
  design needed, same fix pattern as the others (route through `OpenISDDriver`'s own public API
  instead of `.toRecord()`).

### Phase D — design passes (produce a draft, need your sign-off before implementation starts)

- **D1. `OpenISDProject` class API.** Design the public getter/method surface for box, target,
  filters, environment, signal, listening, simOptions, sweep, meta — mirroring `OpenISDDriver`'s
  `cell()`/`enter()`/`clear()` pattern where it fits, never exposing `_OpenISDProjectJson` raw.
  **HARD GOAL, ruled (human, 2026-08-18): kill `UiParams`/`state.P` entirely as part of this
  design — not deprecate, not wrap, DELETE.** Verified near-exact 1:1 duplication against
  `OpenISDProject`'s own already-declared sub-domains: `nDrivers/wiring/Rs/Pin` ↔
  `OpenISDSignal`'s `driverCount/wiring/seriesResistance_ohm/inputPower_W`; `circuitModel/
  tlPortModel/forceFlatResponse/splXmaxLimited/vcTempRise/alfaVC/driverAddedMass` ↔
  `OpenISDSimOptions` (exact field names); `tempK/humidityPct/pressurePa/
  ignoreHumidityAndPressure` ↔ `OpenISDEnvironment` (exact field names); `fmin/fmax/N` ↔
  `OpenISDSweepRange`'s `fmin_hz/fmax_hz/points`; `Vb/ventD/ventW/ventH/ventL/Fb/Frc/prFp/
  entered/Ql/Qa/Qp` ↔ `OpenISDBox`/vent/PR-alignment fields; `filters` ↔
  `OpenISDProject.filters` directly. Every `UiParams` field gets a home on the real domain
  object it duplicates — D1's design task is explicitly "distribute `UiParams`'s ~40 fields
  onto their true owning domain classes," not merely "design a wrapper class alongside it."
  `state.P: UiParams` (`AppState`, `types.ts:299`) dies with it — every consumer reads/writes
  through `OpenISDProject`'s own properties instead. This is QO54 (questions.yml, open since
  before this session) — this design task IS QO54's implementation.
  Blocks: Phase 1 (can't rename/restructure `ManagedOpenISDProject` around a class that doesn't
  exist yet), B4, B5 (their fix destination), Phase 3/4 (every `state.P.*` read/write site).

  **HARD GOAL, ruled (human, 2026-08-18): `AppState` itself is deleted, not merely trimmed** —
  it duplicates the project object the same way `UiParams` does, one level up. `types.ts:295`'s
  domain-owned fields get the same "distribute to the true owner" treatment:
  - `box: BoxType` → `OpenISDProject.box`'s own active-alignment kind, not a sibling copy.
  - `lossMode: string` (*"Sealed-box loss model"*) → **ruled (human, 2026-08-18): data lives on
    `OpenISDBox`'s sealed alignment; its UI editing control co-locates with the
    `OpenIsdSealedBox` component** (a sibling of `OpenIsdVentedBox` and the other alignment
    components) — not a flat `AppState` field, and not scattered elsewhere in the UI.
  - `P: UiParams` → deleted per the `UiParams` goal above.
  - `project: ProjectMeta` → **ruled: deletion goal recorded** — duplicate of
    `OpenISDProjectMeta`, consumers repoint there.
  What survives is only the genuinely UI-only fields Explore already separated out (`graphs`,
  `editDriver`/`editDriverInfo`/`browseOpen`/`defineOpen`, `cursorF`/`pinnedF`/`cursorLocked`/
  `dragRange`/`yRanges`) — these move into `UiState`, **RULED (human, 2026-08-18): renamed to
  `ViewState`**, promoted to its own top-level store (one of the three approved stores
  ARCHITECTURE.md already names) rather than staying nested inside anything claiming to be
  `AppState`.

  **Second follow-up sweep, 2026-08-18 — more duplication found, all ruled:**
  - **`state.box: BoxType`** (`store.ts:180`) — confirmed a genuinely DISCONNECTED second copy
    of "which box alignment is active," not merely an unwired convenience field: set directly
    in 5 places (`store.ts:481,498,551`, `OgNewProject.vue:46`, `OriginalShell.vue:95,512`),
    none of which also write `OpenISDBox.active` — the two can silently disagree today. **RULED:
    `state.box` is a project-level domain setting, not screen state — it moves onto
    `OpenISDProject`/`ManagedOpenISDProject` entirely.** No separate `state.box` variable
    survives; every read/write goes through the project object directly. All 5 write sites need
    updating to write there instead.
  - **`Design.P: PlotParams`** (`types.ts:60-74`, used for a pinned/compared-designs chart
    feature) — **RULED (human, 2026-08-18): there is no compare-designs feature in OpenISD —
    delete `Design`, `PlotParams`, and all supporting code for this feature outright**, not
    just its `P` field. Scope not yet swept: needs its own pass to find every consumer of
    `Design`/`PlotParams`/whatever UI (comparison chart traces, pinned-design list, etc.)
    depends on it, before deletion — flagged, not yet done.
  - `ProjectMeta` (`types.ts:316-322`) reconfirmed as an exact field-for-field duplicate of
    `OpenISDProjectMeta` — same ruling as before (delete, repoint consumers).
  - `UiState`'s `envDefaults` (seeds a NEW project's Advanced-pane defaults, not a live mirror
    of a project's own environment) and `lossMode`'s domain-gap status (see below) were also
    checked — `envDefaults` judged legitimately distinct, not a violation, no action needed.

- **D2. `types.ts` split — target file layout.** Decide where each of the remaining shapes
  moves: which are `OpenISDProject`/`OpenISDDriver`-adjacent (co-locate with the owning domain
  type), which are genuinely UI-only (own file per concern, feeding the `AppState` replacement
  above), which are dead/duplicate (`ProjectMeta` — delete, per the `AppState` goal). Blocks:
  Phase 1 cleanup step, Phase 3 (some store.ts exports reference these types).
- **D3. `CircuitSolverParams` field list.** Finish the `deriveDriver` body trace (item #7) to
  lock which fields are truly required vs. optional (`Pe`/`Xmax` likely optional; `Dd`/`no`
  become real declared fields) before writing the class. Blocks: B7-adjacent `.wpr` rewrite
  (item #8's still-open scoping), Phase 3's `driver`/`driverRecord` migration.
- **D4. `_OpenISDProjectJson`'s `PrivateAllow` list and file location.** Natural answer: same
  file as the new `OpenISDProject` class (model package, alongside `openisdDriver.ts`'s
  pattern), `PrivateAllow` = that class's own file + `store.ts` + whichever file becomes the
  project-equivalent of `openIsdDriverFileIo.ts`. **You must make this edit yourself** once D1
  is drafted — `PrivateAllow`/`ALLOWED_GLOBALS` entries are human-only per your rule.

### Phase 0 — the enforcement gate, written to fail first — DONE (2026-08-18)

- **0.1. DONE.** Added `packages/ui/test/ui/architecture.test.ts`'s `describe('module-level
  globals — only openProjects()/focusedProject() are legal')` block — same regex-based approach
  as `PrivateAllow`, `ALLOWED_GLOBALS` co-located and human-edit-only. **Scope judgment call
  made here, not in the original spec:** scans only `store.ts` (`SCANNED_FILES`), not
  blanket-every-module-under-`packages/ui/src` as first drafted — that would have flagged
  thousands of unrelated exports (types, enums, component props) across the whole UI codebase.
  Extend `SCANNED_FILES` deliberately, file by file, as more modules are confirmed to hold
  state — never widen it to "everything" in one shot. Flag if this scoping call was wrong.
- **0.2. DONE.** Seeded `store.ts`'s `ALLOWED_GLOBALS` with `['openProjects', 'focusedProject']`
  ONLY. Verified: fails loudly, naming all ~30 current violations (full list in the test output
  — `state`, `managedProject`, `driver`, `driverRecord`, `driverErrors`, `enterVentField`, etc.)
  — exactly the plan's intended checklist for Phase 3. Full `architecture.test.ts` run shows
  this as the ONLY new failure beyond the 4 pre-existing ones already on this branch.
- That failure list becomes Phase 3's
  literal checklist.

### Phase 1 — rename `ManagedProject` → `ManagedOpenISDProject`, introduce `OpenISDProject`

Blocked on D1 (needs the class to rename/restructure around):

- **1.1. DONE (2026-08-18).** `ManagedProject`/`ManagedProjectListener` renamed to
  `ManagedOpenISDProject`/`ManagedOpenISDProjectListener` across all 10 consuming files. File
  itself NOT renamed to `managedOpenIsdProject.ts` — left as `managedProject.ts`, a judgment
  call to keep this commit a pure identifier rename with no import-path churn; revisit once D1
  restructures the file's contents anyway. Verified: architecture.test.ts +
  managedProject.test.ts + managedProjectBoxFields.test.ts (41 tests) show the same failures as
  the prior baseline, no new ones; vue-tsc clean on this specifically.
- **1.2.** Introduce the `OpenISDProject` class per D1's design; `ManagedOpenISDProject` holds 3
  instances of it (one per ground/committed/overlay layer) instead of 3 raw
  `_OpenISDProjectJson` copies. **NOT STARTED — needs D1's design first.**
- **1.3.** Update the ~15 consuming files' import specifiers/identifiers (mechanical, same
  `perl -pi` approach used for `_OpenISDDriverJson` today) — no call-site logic changes yet.
- **1.4./1.5. DONE (2026-08-18).** `packages/ui/src/logic/model/OpenISDProject.ts` (the
  duplicate class), `workspace.ts`, and their only consumer `openisd-project.test.ts` all
  deleted. **The earlier caution here was wrong, corrected before acting, not after**: verified
  first (`grep` for real import sites) that neither file was imported by ANY production code —
  both were used only by their own test. `OriginalShell.vue`, which actually implements the
  app's multi-project UI, has its own separate, disconnected local `openProjects`/
  `activeProjectId` state and never touched either deleted file. So this was pure dead-code
  removal, not the "deleting live functionality" risk flagged in the earlier draft of this
  plan — `docs/design/STATE_MODEL.md` reading turned out unnecessary once that was confirmed.
  Verified: 107 tests across `architecture.test.ts`+`test/logic` show the same failures as
  before this deletion (one extra pre-existing failure in `store-issue-channel.test.ts`
  confirmed via `git stash` to predate this commit — just not included in earlier baseline
  runs this session). `OriginalShell.vue`'s own local implementation is still separate,
  larger follow-on work — it's live and load-bearing, unlike what was just deleted.
- **1.6. DONE (2026-08-18).** Model-package `OpenISDProject` interface → `_OpenISDProjectJson`.
  `_OpenISDProjectJsonPrivateAllow` NOT added — per D4, that's your edit to make.
- **1.7.** `Layer` loses its `driver` field (no surviving justification, per today's findings) —
  becomes `{ project: OpenISDProject }` or removed as a named type entirely, per D1.
- **1.8.** `types.ts` cleanup per D2 — move/delete the 17 shapes to their decided homes.

### Phase 2 — turn the singleton into a registry

- **2.1.** Introduce `openProjects: Ref<ManagedOpenISDProject[]>` and a `focusedIndex`/similar
  internal cursor in `store.ts`, replacing the single `managedProject` module const.
- **2.2.** Export exactly `openProjects()` and `focusedProject()` as **plain functions** (ruled
  — not Vue computed refs).
- **2.3.** `OriginalShell.vue`'s ad-hoc `openProjects = ref<any[]>([])`/`activeProjectId` pair —
  replaced by this registry, not kept alongside it.

### Phase 3 — migrate the ~40 store.ts exports onto `ManagedOpenISDProject`

Use the Explore agent's export table (kind, consumer list, call-site counts) as the literal
checklist — cross-check against Phase 0's red test output, which is authoritative:

- **3.1.** Direct pass-throughs (`driver`→`.toDriver()`, `driverRecord`→
  `.recordToPersist().driver`, `driverErrors`→`.errors()`, `enterDriverField`/`clearDriverField`
  →`.enter()`/`.clear()`, `driverCell`→`.cell()`, box/vent/PR flat accessors, ground-checkpoint
  pair, `loadDriverRecord`) — delete the `store.ts` indirection, call
  `focusedProject()!.<method>()` directly at each consuming call site. (Edit-draft methods
  deleted per B2, not migrated.)
- **3.2.** Pure UI-presentation exports with no per-project meaning (`unitToken`/
  `cycleUnitToken`/`resetUnitTokens`/`unitLabelOf`/`formatInUnit`, vent/PR target-field UI
  helpers) — stay as free functions/a small presentation-state module, flagged by name with a
  one-line justification, not silently kept as `store.ts` globals.
- **3.3.** Dead exports (`driverMetaCell`, `driverWarnings`, `curveIssues`, `restoreProblems`
  external use, `unitLabelOf`, PR-field wrapper functions) — re-grep immediately before
  deleting, then delete outright.

### Phase 4 — rewire the ~15 consuming files

Lowest call-site-count first: `NumInput.vue`, `UnitToggle.vue`, `PRDefineModal.vue`/
`PREditModal.vue`/`DriverBrowserWinisd.vue`/`OgFilters.vue`, `AdvancedOptions.vue`,
`OptionsModal.vue`, `DriverEditorModal.vue` (also fixes B8's 4 violators while here),
`OgNewProject.vue`, `App.vue`, `driverLibrary.ts`, `driverSelection.ts`, `useDesignIO.ts`
(also fixes B5's PR/RHO/C duplication while here), `GraphPanel.vue`, `OgTune.vue`,
`OriginalShell.vue` (largest, last — 208 `state` call sites alone). Each file's own tests run
after that file's migration, not deferred to the end.

---

## Verification

- Phase 0's architecture test is the master checklist: starts red naming every violation, is the
  single source of truth for "is this migration done" — green means every module-level export in
  `packages/ui/src` is either `openProjects`/`focusedProject`, or has an explicit,
  human-authored `ALLOWED_GLOBALS` entry.
- `npx tsc --noEmit -p packages/ui` / `npx vue-tsc --noEmit -p packages/ui` clean after EACH
  phase, not just at the end.
- Full `vitest run` for `packages/ui/test` (background, not foreground) after each phase.
- Manual smoke test via `/run` once Phase 4 is complete: open two projects, switch focus, confirm
  ground/modified and driver state stay correctly scoped per project — today there is only ever
  one project, so multi-project correctness has no existing test coverage to lean on.

---

## Appendix — full data-carrier inventory (reference)

Every Driver/Project/PR carrier found across all 4 packages, including unnamed carriers
(serialized-state shapes, file-io payloads, snapshot/record types), not just name matches.
**REC:** = recommendation, safe to act on. **NEED YOU:** = a real decision, listed above.

**model package**

- `OpenISDProject` — Project — `openisdProject.ts` — canonical project record. Same file also
  declares: AlignmentKind, OpenISDVent, OpenISDSealedAlignment, OpenISDVentedAlignment,
  OpenISDBandpass4Alignment, OpenISDPassiveRadiatorAlignment, OpenISDPassiveRadiatorRef,
  OpenISDBox, OpenISDTarget, OpenISDEnvironment, OpenISDSignal, OpenISDListening,
  OpenISDSimOptions, OpenISDSweepRange, OpenISDProjectMeta. **DECIDED:** rename to
  `_OpenISDProjectJson`.
- `OpenISDProjectMeta` — Project — `openisdProject.ts` — name/creator/created/modified/
  description. **REC:** keep; delete the duplicate `ui/types.ts` `ProjectMeta`, point consumers here.
- `OpenISDBox` — Project — `openisdProject.ts` — all 4 alignments + active flag + losses. **REC:** keep.
- `OpenISDVentedAlignment`/`Bandpass4Alignment`/`SealedAlignment` — Project — `openisdProject.ts`
  — per-alignment geometry. **REC:** keep.
- `OpenISDPassiveRadiatorAlignment` — PR — `openisdProject.ts` — PR-box alignment. **REC:** keep
  (PR-consolidation is a later pass).
- `OpenISDPassiveRadiatorRef` — PR — `openisdProject.ts` — self-marked placeholder. **NEED YOU
  (Open Decision #5).**
- `OpenISDVent`/`Target`/`Environment`/`Signal`/`Listening`/`SimOptions`/`SweepRange` — Other-
  carrier — `openisdProject.ts` — project sub-records. **REC:** keep.
- `OpenISDDriver` — Driver — `openisdDriver.ts` — live driver class over `_OpenISDDriverJson`.
  Same file also declares: _OpenISDDriverJson, CellState, Cell, DriverListener, SpecField,
  MetaField, MetaCell. **REC:** keep, sanctioned.
- `_OpenISDDriverJson` — Driver — `openisdDriver.ts` — driver's persisted record shape. **REC:** keep.
- `Cell`/`MetaCell` — Other-carrier — `openisdDriver.ts` — per-field provenance wrapper. **REC:** keep.
- `_SpecSection` — Driver — `openisdRecord.ts` — T/S spec fields sub-block. Same file also
  declares: SourceRole, Reading, DqKind/Severity, DqMark, DQStatus, _SpecEntry, _ScrapedField,
  Ground, _DerivedField, _BookkeepingField, Disposition, DispositionField, Rating,
  CrossSourceReading, QualityBlock, _Specs, CurveEntry, CurvesBlock. **REC:** keep, already
  gated by `PrivateAllow`.
- `_Specs` — Driver — `openisdRecord.ts` — container of all spec sections. **REC:** keep.
- `_SpecEntry`/`_ScrapedField`/`_DerivedField`/`_BookkeepingField`/`DispositionField`/
  `CrossSourceReading`/`QualityBlock` — Other-carrier — `openisdRecord.ts` — per-field
  value+provenance wrappers. **REC:** keep.
- `CurvesBlock`/`CurveEntry` — Other-carrier — `openisdRecord.ts` — curve-data payload. **REC:** keep.
- `OpenISDDerivation` — Other-carrier — `openisdDerive.ts` — derived T/S values result bag. **REC:** keep.

**winisd package**

- `WinISDDriver` — Driver — `winisdDriver.ts` — `.wdr` file-format boundary class. Same file
  also declares: WdrCell, WdrCells, WdrHeader. **REC:** keep, sanctioned.
- `WdrHeader`/`WdrCell`/`WdrCells` — Other-carrier — `winisdDriver.ts` — `.wdr` format sub-shapes. **REC:** keep.
- `ModeledSlot` — Other-carrier — `parstate.ts` — WDR field-slot metadata mapping (also:
  CellState). **REC:** keep.
- `WprInput` — Project — `classic/wpr.ts` — full `.wpr` writer payload. Same file also declares:
  WprVent, WprBox, WprPr. **REC:** keep, correctly scoped.
- `WprBox`/`WprVent` — Project — `classic/wpr.ts` — box/vent sub-shapes. **REC:** keep.
- `WprPr` — PR — `classic/wpr.ts` — `.wpr` PR sub-shape. **REC:** keep.

**engine package**

- `Driver` — Driver — `types.ts` — fully-derived physics driver. Same file also declares:
  Complex, IssueLevel, DriverError, Result, DriverRaw, BoxType, Wiring, CircuitModel, FilterType,
  Filter, SweepParams, Solution, SweepResult, MaxCurvesResult. **REC:** keep — distinct
  physics-computation layer.
- `DriverRaw` — Driver — `types.ts` — raw pre-derivation T/S input. **REC:** keep (AD-9 marks it
  obsolete-do-not-extend already; deletion is separate cleanup).
- `SweepParams` — Other-carrier — `types.ts` — box+drive+environment bag for sweep. **REC:** keep.
- `SweepResult`/`MaxCurvesResult`/`Solution` — Other-carrier — `types.ts` — computed-curves
  payload. **REC:** keep.

**ui package**

- `OwprFile` — Project — `logic/model/OpenISDProject.ts` — `.owpr` payload (also:
  ProjectContent). **REC:** delete with the file (Phase 1).
- `ProjectContent` — Project — `logic/model/OpenISDProject.ts` — box/P/driver/meta bag (also:
  OwprFile). **REC:** delete (Phase 1).
- `OpenISDProject` (ui class) — Project — `logic/model/OpenISDProject.ts` — the duplicate itself
  (also: ProjectContent, OwprFile). **DECIDED:** delete (Phase 1).
- `WorkspaceEntry`/`WorkspaceSnapshot`/`OpenProject` — Project — `logic/model/workspace.ts` —
  session/persistence bookkeeping for the duplicate class. **NEED YOU (Open Decision #2).**
- `ManagedProject` — Project — `managedProject.ts` — sanctioned 3-layer facade (also:
  ManagedProjectListener, Layer, Overlay). **DECIDED:** rename to `ManagedOpenISDProject`.
- `Layer` — Project — `managedProject.ts` — one state layer. **DECIDED:** collapses, no
  surviving `driver` field — see Status at a glance.
- `DriverJSON` — Driver — `types.ts` — alias of `OpenISDDriver.toRecord()`. Same file also
  declares: ChartTabId, Series, PlotData, PlotParams, Design, RangeStats, DragRange, Geo,
  PRLibEntry, BundledPR, UiParams, SyncedParams, YRange, UiState, AppState, ProjectMeta,
  SerializedState (17 shapes, one file). **REC:** keep the alias; **NEED YOU (Open Decision #3)**
  on splitting the file.
- `Design`/`UiParams`/`SyncedParams` — Other-carrier — `types.ts`. **REC:** keep the types; move
  only as part of Open Decision #3.
- `AppState` — Other-carrier — `types.ts` — whole live store state. **REC:** this IS what Phases
  2-3 dismantle — no separate action, disappears as part of the migration.
- `ProjectMeta` — Project — `types.ts` — duplicate-by-name of `OpenISDProjectMeta`. **REC:**
  delete, repoint consumers; small, safe, lands in Phase 1's cleanup.
- `UiState` — Other-carrier — `types.ts` — local UI prefs. **REC:** keep, not project data.
- `SerializedState` — Project — `types.ts` — persisted/URL save-load-share snapshot. **REC:** keep.
- `PRLibEntry`/`BundledPR` — PR — `types.ts` — saved/bundled PR entries. **REC:** keep — PR
  follow-on scope.
- `PrDatasheetInput`/`PrCanonical` — PR — `logic/prWinIsdFields.ts` — raw vs. solved new-PR
  fields. **REC:** keep — same follow-on.
- `LibraryEntry`/`FileReadResult` — Driver — `logic/driverSelection.ts` — driver-pool row/file-
  read outcome (also: SelectionResult, EditorSubject, DriverSelection). **REC:** keep.
- `SelectionResult` — Other-carrier — `logic/driverSelection.ts` — ok/error outcome. **REC:** keep.
- `StoredBlob`/`UpgradeResult` — Other-carrier — `logic/schemaUpgrade.ts` — pre-upgrade blob/
  upgrade-chain result (also: UpgradeStep). **REC:** keep.
- `MyDriverRepo` — Driver — `db/myDrivers.ts` — IndexedDB repo over `_OpenISDDriverJson`. **REC:** keep.

`openIsdDriverFileIo.ts`/`winIsdDriverFileIo.ts` declare no carrier types of their own (pure
functions over `_OpenISDDriverJson`). `useDesignIO.ts`'s `DesignIO` is a function-bag, not a
carrier, omitted.

---

## Justification for the recommended consolidation

1. **`types.ts` is the real root cause.** Every duplication found has one shape in the file that
   owns the concept and a second shape dumped in the grab-bag. `ALLOWED_GLOBALS` (Phase 0)
   generalizes the `_OpenISDDriverJson`/`PrivateAllow` rule from "one type protected" to "every
   module-level export protected" — the same enforcement, wider net.
2. **The two `OpenISDProject`s were two live, disconnected state machines**, not a naming
   accident — two different answers to "has this project changed since it was saved," able to
   silently disagree. Deleting one removes a real divergence risk, not just a name clash.
3. **The `ManagedOpenISDProject` rename removes the naming collision permanently.** If the facade
   kept the name `ManagedProject`, the bare name `OpenISDProject` would stay free for another
   agent to reach for later, recreating the same collision under a different pairing.
4. **Rename (Phase 1) before registry (Phase 2) and store rewrite (Phase 3) is deliberate risk
   sequencing.** Phase 1 changes only identifiers — verifiable by `tsc`+tests alone, no behavior
   to reason about. Splitting it from the phases that change runtime behavior means a failure
   can only mean one thing at a time.
5. **Phase 0's test-first ordering is what stops this migration from being trusted on my say-so.**
   The test enumerates every violation mechanically before any fix — "done" is defined by
   `ALLOWED_GLOBALS` entries the human added plus deletions, never by an agent's assessment that
   a call site "looks migrated."

RULING:
