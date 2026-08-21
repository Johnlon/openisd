# QO60 + QO61 — layering remediation

## Context

Four `architecture.test.ts` gates are red, blocking every commit under the "no commit without
all errors and warnings fixed" rule. They are red for one reason: the UI reaches directly into
storage and into private JSON shapes instead of going through domain wrappers. QO60 (store as
STORAGE behind a service), QO52 (module globals), QO58/QO57 (private-shape leaks) and QO61
(`useDesignIO.ts` mixing I/O with physics) are all facets of that single defect.

Outcome: every gate green, so the pending checkpoint commit can land.

## WHY the access rules exist — the duplication they were meant to prevent

**John, 2026-08-20: "this is why I keep telling you that no one at all should see the underlying
state."** Visibility of the shape is what allowed a second copy of it to grow. `state.P` holds
`Ql`/`Qa`/`Qp`, `tempK`/`humidityPct`/`pressurePa`/`ignoreHumidityAndPressure`,
`nDrivers`/`wiring`/`Pin`/`Rs`/`rgAtDriverSide`, the seven `simOptions`, `fmin`/`fmax`/`N`,
`filters` and `entered` — and `_OpenISDProjectJson` already declares a home for every one of
them (`box`, `environment`, `signal`, `simOptions`, `sweep`, `filters`, `target`, `meta`). Had
the shape never been reachable, the only way to hold those values would have been to call
methods on the object that owns them, and the parallel copy could not have been written.

The rules below are therefore not hygiene — they are what makes this class of duplication
impossible to author. Judge every proposed exception against that: does it let someone hold
state the domain object already owns?

## The access rules (John, 2026-08-20) — these bind everything below

> **`ManagedX` may access only the API of `X`, never `_XJson`.**
> **`ManagedX` clones `X` by asking `X` for a copy of itself — never by touching its JSON.**

| Component | Rule |
|---|---|
| `OpenISDDriver` / `OpenISDProject` | Own their JSON; may share it privately with each other (they are the domain API classes). JSON shape collocates with its wrapper class. |
| `ManagedOpenISDProject` | No JSON access at all. Domain API only. Owns what a copy MEANS (ground/committed/what-if); `OpenISDProject` supplies the copy and knows nothing of layers. |
| `store.ts` | TRANSITIONAL ONLY. It may hold `_OpenISDProjectJson` while that is what it stores, and may never expose it. **Once objective 3 lands, the store wraps an `OpenISDProject` and therefore has NO right to speak to the JSON at all** (John, 2026-08-20) — its allow-list entry is removed then. The grant is scaffolding for a shape that is going away, not a standing right. |
| `winIsdDriverFileIo.ts` | No driver-JSON access. (Open: revoke its twin `openIsdDriverFileIo.ts`'s existing grant for symmetry?) |
| **UI ↔ JSON** | **The UI must NEVER talk to a JSON shape. No exceptions** (John, 2026-08-20). No `.vue` file, and nothing the UI reaches through, may name `_OpenISDDriverJson`/`_OpenISDProjectJson` or any successor. The UI takes domain objects, services, or purpose-built projections (the driver card) — never a record. |
| Default-deny | Absent/empty/missing/broken allow-list ⇒ prohibited. Absence of a control is never permission. Only John's explicit allow grants access — no exceptions, for any mechanism now or later. |
| Discriminators | Named type-safe enums, never ints. Bool only where genuinely binary. |
| Calc | Formulas live in `@openisd/engine` only; reached through a domain getter that does entered-override → `C` fallback. |

### Governing principle: the UI is THIN, the logic is TESTABLE

**John's standing instruction, restated 2026-08-21: keep the UI as thin as possible and put the
behaviour in logic, so it can be unit-tested.** A `.vue` file holds markup, bindings and event
wiring. It holds no rule, no predicate, no derivation, and no domain value — those go in
`logic/`, where a test can call them without mounting a component.

Violated by this agent the same day and corrected: `isQ` — a domain predicate asking whether a
field is one of the Qts/Qes/Qms trio — was written as a local `const` inside `OgTune.vue`. It
now lives in `logic/` as `isQGroupField()`. The lesson is the test: **if a rule can only be
exercised by rendering a component, it is in the wrong file.**

The existing gates do NOT catch this. They check IMPORTS (a component importing a domain value,
a package importing across a layer). A rule written inline in a `.vue` file imports nothing, so
nothing flags it. See the new gates below.

### Objective 11 — new architecture gates

Three gaps the current `architecture.test.ts` cannot see:

1. **Re-export is prohibited.** `export { X } from 'other-package'` launders another package's
   type into yours: every consumer then depends on that package transitively while appearing to
   depend only on yours. Precedent: `openisdDriver.ts:36` re-exported `CellState` from
   `@openisd/winisd`, so every provenance consumer depended on the format package. Fixed
   2026-08-21 by declaring `Provenance` in `@openisd/model`. Gate it so it cannot return.
2. **Importing someone else's import is prohibited.** A file must import a name from the module
   that DECLARES it, never from a module that merely re-exports or passes it along. Same defect,
   consumer side.
3. **A domain VALUE must not pass through a component**, not merely not be imported by one.
   `DriverEditorModal.vue` never named `Provenance`, but `cellOf(field).state` put one in its
   hands and it handed it onward — invisible to an import-based gate, the same blind spot as
   QO58. Fixed 2026-08-21 by `cellClassFor(cellOf, field)` doing the read inside `logic/`.
   Gate the SHAPE: a component may not hold a value whose type is owned by the domain.

All three are AST checks over declarations, never greps over prose — a comment naming a rule
must not fail its own gate.

## What the research established

**`store` vs `driverRepo` — no overlap.** `driverRepo` is the CATALOGUE: 1,526 bundled drivers,
stateless, Vue-free, read-only, answers "which drivers exist / match this filter".
`store` is the WORKBENCH: the one open project, fully reactive. `store` holds no driver at all —
`managedProject` does. The two never import each other; only `driverSelection.selectDriver`
bridges them. `driverLibrary` = the picker's UI state (browsing); `driverSelection` = the
consequences (committing). `myDrivers` = one `localStorage` key, full records, via `KeyValueStore`.

**`store.ts` — 50 exports** (the gate reports a subset): 18 DELEGATE, 12 DERIVED, 10 DOMAIN-OP,
7 STATE, 3 UTILITY. **10 have zero callers.** The 18 delegates are two patterns: nine bind
`state.P`/`state.box` into the vent/PR solvers; five add a `void _version.value` touch then
forward to `managedProject`; four add nothing at all. **`state.P`'s 19 accessor properties are DELEGATES and get DELETED** (John's ruling
2026-08-20: "must be via direct domain object call as you have setters"). `store.ts:202-245`
(`defineBoxFieldAccessors`) installs 19 get/set pairs that forward to `managedProject` and add
nothing: `Vb`→`mp.boxVolume_m3()`/`mp.setBoxVolume_m3(v)`, `Vf`→`mp.frontVolume_m3()`,
`Fb`→`mp.boxTuning_Fb_hz()`, six vent fields→`mp.activeVentField(k)`/`mp.setActiveVentField(k,v)`,
six PR fields→`mp.prField(k)`/`mp.setPrField(k,v)`, `prNum`→`mp.prCount()`,
`prMadd`→`mp.prAddedMass_kg()`, `prFp`→`mp.prFp_hz()`, plus `entered` (a live Proxy over
`mp.isEntered`/`mp.setEntered`, whose setter also reaches `mp._snapshot()` — an escape hatch to
close in the same pass).

They are property-shaped convenience wrappers, the same defect as the 18 function delegates.
Delete `defineBoxFieldAccessors` outright; every `state.P.Vb` read/write becomes
`managedProject.boxVolume_m3()` / `.setBoxVolume_m3(v)` at the call site. The setters already
exist, so nothing new is written — this is repointing, done with ts-morph.

What legitimately REMAINS in `state` afterwards: the plain simulation params (`P_DEFAULTS`:
Ql/Qa/Qp, Pin, Rs, fmin/fmax/N, filters, …) and the UI-only flags (`browseOpen`, `editDriver`,
`cursorF`, `graphs`, `yRanges`) — the latter arguably belong in a UI-state object rather than
the project store at all.

`OriginalShell.vue:22-30` imports 21 names: `state, engineDriver, driverName, driverRecord,
syncedP, curvesData, maxData, driverErrors, isModified, resetProjectToGround, groundCheckpoint,
restoreGroundCheckpoint, markProjectSaved, managedProject, formatInUnit as fmtU, enterVentField,
clearVentField, ventFieldState, ventMaxReachableFb, ventTargetUnreachable, newProject`.

**The index card is justified.** The picker reads ~14 scalars + one chips array per row:
`name`, date, `_canonical`, `_types[]`, `_Fs`, `_Sd`, `_Znom`, `sourceName`/`sourceDesc`/
`sourceKey`/`path`, four link URLs, two date flags, one DQ boolean. `record`, `content`, `_Re`,
`_Pe`, `myDriverData` are touched only AFTER a row is clicked. No JSON access is warranted.

## PARKED — separate discussions, after the current matters are settled (John, 2026-08-20)

Not to be actioned or re-raised until then; recorded here so none is lost.

1. **Reactivity, generally** — and `BUG_20260820_syncedp_filters_deep_copy_is_a_reactivity_workaround.md`
   as its first instance. Also relevant: deleting the 19 `state.P` accessors removes what
   currently makes those fields reactive to templates, so the reactivity design has to be
   settled before objective 2's property half can land.
2. **Memory of holding 1,526 live drivers.** `#cache` fills on first `cell()` with the whole
   field solve, so the resident cost is the solve caches, not the instances (~0.4 MB empty,
   possibly several MB populated). UNMEASURED — measure during objective 4. If large, extract
   the index rows and drop the drivers, re-materialising on click. NOT by reintroducing the
   flyweight, which is rejected.

## Bugs recorded this session — all WRITTEN, all OPEN, none fixed

`bugs/BUG_20260820_*`, in the repo:

| Bug | Blocks |
|---|---|
| `readcell_builds_and_discards_a_whole_driver_to_read_one_field` | objective 4 |
| `drivers_bundle_ships_a_shape_openisddriver_cannot_read` | objective 4 |
| `model_depends_on_winisd_and_re_exports_its_cellstate` | objective 8 (new) |
| `syncedp_computes_eg_inside_the_store` | objective 2 |
| `syncedp_filters_deep_copy_is_a_reactivity_workaround` | PARKED (reactivity) |
| `wpr_writer_emits_phantom_vent_for_a_passive_radiator_project` | independent |
| `s-roo_wdr_oracle_contradicts_the_c-from-roo_recompute_rule` | independent |
| `winisdAir_compat_mode_fidelity_questionable_after_c_roo_research` | independent |

## Rulings recorded here but not yet reflected in code or docs

- **A domain object's own methods protect its integrity.** It never relies on callers
  remembering to do the right thing. `_projectToPersist` is the model: the what-if cancellation
  is INSIDE the call, so no caller can forget it. Persistence asking MOIP for data is what
  triggers the cancel. Apply to every MOIP method that could leave state inconsistent.
- **OIP may see OID; OID may not see OIP.** VERIFIED in code: `openisdProject.ts:29` imports
  `_OpenISDDriverJson` (the granted edge); `openisdDriver.ts` imports nothing from
  `openisdProject.ts` — the two hits there are a comment and the allow-list string. Watch this
  when OIP becomes a class: a `.driver` accessor returning a live `OpenISDDriver` needs a VALUE
  import, not `import type`, turning an erased edge into a runtime one.
- **WinISD has no right to know OpenISD exists.** VERIFIED holding: `packages/winisd/src` has
  zero imports from `@openisd/model`; it is a devDependency for tests only. The residue is
  seven comments in `winisdDriver.ts` naming OID, one of which (`:243`) names
  `WinISDDriver.fromOpenISDDriver(driver)` — a method that DOES NOT EXIST. Delete the stale one
  at minimum; the rest are evidence for the bug below until it is fixed.
- **The reverse arrow is the real breach — see objective 8.**

## Objectives

**1. Free deletions — `store.ts` 50 → 40 exports.** Un-export the ten with zero callers:
`enterPrField`, `clearPrField`, `prFieldState`, `prTargetUnreachable`, `loadDriverRecord`,
`driverMetaCell`, `driverWarnings`, `curveIssues`, `restoreProblems`, `unitLabelOf`.
Zero behaviour change; typecheck is the proof.

**2. DELETE `state.P` ENTIRELY** (John's ruling 2026-08-20), and with it all 37 delegates.

`state.P` is a parallel copy of project state. Every field has a declared home already:

| `state.P` | goes to |
|---|---|
| `Ql`, `Qa`, `Qp` | `box: OpenISDBox` |
| `tempK`, `humidityPct`, `pressurePa`, `ignoreHumidityAndPressure` | `environment: OpenISDEnvironment` |
| `nDrivers`, `wiring`, `Pin`, `Rs`, `rgAtDriverSide` | `signal: OpenISDSignal` |
| `circuitModel`, `tlPortModel`, `forceFlatResponse`, `splXmaxLimited`, `vcTempRise`, `alfaVC`, `driverAddedMass` | `simOptions: OpenISDSimOptions` |
| `fmin`, `fmax`, `N` | `sweep: OpenISDSweepRange` |
| `filters` | `filters: Filter[]` |
| `entered` | `target: OpenISDTarget` |
| the 19 box/vent/PR accessors | `box: OpenISDBox` (already delegating) |
| `state.project{name,creator,…}` | `meta: OpenISDProjectMeta` |

Callers reach all of it through `ManagedOpenISDProject`'s methods — never a held copy.

The view state goes to **`logic/presentationState.ts`**, which is ALREADY the approved home for
it — declared in `architecture.test.ts:451`'s `APPROVED` list and marked "not built yet". No new
decision is needed and none should be re-litigated: dialog flags (`browseOpen`, `defineOpen`,
`editDriver`, `editDriverInfo`), chart interaction (`cursorF`, `pinnedF`, `cursorLocked`,
`dragRange`), display selection (`graphs`, `yRanges`, `lossMode`), app preferences (`ui.skin`,
`ui.unitTokens`, `ui.envDefaults`). Building it is part of this objective.

The three formerly-uncertain fields are settled:

- **`driverSource` — DELETED** (done). One occurrence, `store.ts:286`, not even declared in
  `AppState`; nothing read or wrote it.
- **`prMode` — DELETE with `state.P`.** Declared `prMode: string` (`types.ts:199`), written to
  the literal `'winisd'` in three places (`store.ts:171`, `PRDefineModal.vue:49`,
  `useDesignIO.ts:284`), READ NOWHERE. A discriminator that discriminates nothing — and a bare
  `string`, which the discriminator rule bans anyway.
- **`Frc` — STUB IT** (John's ruling 2026-08-20: "if Frc is a box type we don't support yet
  then just stub the UI call to the domain and wait until we build it"). Verified: the editable
  `Frc` input renders ONLY for `selectedBox === 'bandpass6' || 'abc'`
  (`OriginalShell.vue:993`); `bandpass4` takes the `v-else` branch, a read-only greyed field
  showing the computed `rearResonance`, and never writes `Frc`. Both `bandpass6` and `abc` are
  unbuilt — `openisdProject.ts:103` states neither exists and ABC has no field spec at all
  (QO44). So the UI calls a domain method that stubs until QO44 builds the alignment; the value
  stops living in the store while its entered-flag lives in `managedProject.ts:92`.

Callers talk DIRECT to the domain object.
18 function delegates + the 19 `state.P` accessor properties above — one defect, one pass. No
wrapper survives as a convenience: `store.driverCell(f)` → `managedProject.cell(f)`,
`state.P.Vb` → `managedProject.boxVolume_m3()`. The five
`_version`-touch forwards
(`driverCell`, `engineDriver`, `driverErrors`, `driverConsistencyIssues`, `driverMetaCell`) need
their reactivity touch preserved — move it into `managedProject`'s own accessors so callers get
reactivity without the wrapper. The nine vent/PR binders move to taking their params explicitly
at the call site (the `*On(...)` functions they forward to are already exported). The four
no-op forwards are deleted outright. Use **ts-morph** for the repointing, not text edits.

**2c. Share links stop going through the store; browser history moves to `urlAppState.ts`.**

`serialize(state, driverRecord.value)` (`persist.ts:26`, called from `useDesignIO.ts:130`) takes
the WHOLE `AppState` — necessary only because the project's fields currently live there. Sharing
never needed the store; it needed the project, and the project's state had ended up in the store.
The same duplication defect, in its serialisation form.

A share link IS a serialised project. Once `state.P` is gone: `moiProject` → serialise → encode.
The store's only remaining involvement is identifying WHICH project is focused, and that is
`focusedProject()`, not `state`.

`history.replaceState(null, '', url)` (`useDesignIO.ts:131`) is browser-history manipulation done
inline in the file-IO composable. That belongs in **`logic/urlAppState.ts`** — already on
`architecture.test.ts:452`'s APPROVED store list, marked "not built yet", exactly as
`presentationState.ts` is. So `urlAppState.ts` is not an extra thing invented for this plan:
objective 2 removes the reason share-link ever touched the store, and `urlAppState` is where the
history side was always meant to live.

**3. `OpenISDProject` becomes a class facade with `copy()`.** Private constructor, static
factories, accessors over the SAME `_OpenISDProjectJson`. Adds `copy(): OpenISDProject`, which
is how `ManagedProject` obtains its three layers — MP never sees the JSON, OIP never learns what
a layer is. `ManagedProject` migrates off `_OpenISDProjectJson`/`_OpenISDDriverJson` entirely.
The PR accessor carries the entered-override→`C`-fallback getters objective 6 needs.

**4. The catalogue index is built ON DEMAND and keyed to the environment settings.**

**Ruling (John, 2026-08-20, superseding the bundle-time option): "no calculations occur at app
start time, and index built or rebuilt using env setting — nothing at bundle time."**

- **Nothing at bundle time — and THE BUNDLE IS THE JSON OBJECT.** Ruled by John 2026-08-20:
  *"I always expect the bundle to look like the Json object so it should be 100pc compatible."*
  `scripts/bundle-drivers.mjs` emits canonical `_OpenISDDriverJson` records verbatim — no
  computed fields, no flattening, no projection type, no second shape for
  `OpenISDDriver.fromRecord()` to accommodate. It ships today's `{inputs}` flat bag instead
  (verified: 1,526 rows, every `record` has exactly one key), which the model cannot read at
  all; fixing that is PART OF THIS OBJECTIVE, not a prerequisite to it — see
  `bugs/BUG_20260820_drivers_bundle_ships_a_shape_openisddriver_cannot_read.md`.
  Cost accepted: the record payload is already 87% of the row data (1,170,044 of 1,347,317 B)
  and provenance envelopes are fatter than a flat bag, so the bundle grows.
  Consequence: no derived build artifact exists, so nothing can go stale and no fingerprint
  guard is needed. `driverRepo`'s existing `readCell`/`readDisplayName`/`data_sources` reads
  start working as written.
- **Nothing at app start.** The app boots without touching the catalogue. A user who never opens
  the picker never pays for it.
- **Built on first demand, rebuilt on env change.** The index is constructed when the catalogue
  is first needed, from the records via the real `OpenISDDriver`, and CARRIES THE ENV SETTINGS
  IT WAS BUILT UNDER. A change to those settings invalidates it and it rebuilds. That key IS the
  correctness mechanism — a stale index is impossible by construction rather than by discipline.

This is why Tier 2 fields (`Vas`, anything using ρ/c) are now safe to include: the index is
env-keyed, so an app-level settings change rebuilds it rather than leaving a frozen answer
behind. Tier 1 vs Tier 2 still matters for reasoning about what a field DEPENDS on, but both are
computed the same way, at the same time, under the same key.

**The intrinsic test — a field may be pre-computed into the index ONLY if it depends on the
driver alone**: not on the enclosure, the environment, the signal, or any project setting. The
current index fields all pass: `name` (identity), `Fs` = 1/(2π√(Mms·Cms)) (no air), `Sd` (pure
geometry), `Znom`, `types`/`canonical` (classified from Fs/Sd/name), the DQ flag (are core
fields present and > 0). Catalogue metadata — `sourceKey`/`sourceName`/`sourceDesc`, `path`,
`date`, `isLatest`/`isOlder`, and the four link URLs — is intrinsic to the ENTRY, not the
driver, and stays on the row beside it. The driver never learns its repo path.

**Widened (John, 2026-08-20): "intrinsic + app-level settings is ok"** — which splits the index
into two tiers by WHERE each field may be computed:

- **Tier 1, purely intrinsic** — `Fs`, `Sd`, `Znom`, `types`, `canonical`, DQ flag. Depend on the
  driver alone and can never change. **Frozen into the bundle at build time.** Everything in
  today's index is Tier 1, so this widening costs nothing now.
- **Tier 2, intrinsic + app-level** — e.g. `Vas` = ρ·c²·Sd²·Cms, which depends on the app's
  reference environment. Permitted in the index, but **NEVER frozen into the bundle**: the user
  can change T/RH/AP in Options at runtime, so a build-time value goes stale immediately and the
  picker would disagree with the editor. Computed at load, recomputed on any app-settings change.

**Still banned outright — project-level:** `Fsc`, SPL in a box, excursion at power, anything
depending on the enclosure or the signal. Those are per-project, not app-level.

The index build constructs the real `OpenISDDriver` per record and reads its cells, so the
engine keeps sole ownership of the formulas. The resulting rows are FLAT data — no driver, no
JSON, nothing for the UI to reach through. A full `OpenISDDriver` is retained only for the row
the user actually clicks.

**Measured cost, and one figure that needs watching.** `drivers-bundle.json` today: 1,526
drivers, 1.27 MB; full rows 1,347,317 B of which the `record` payload is 1,170,044 B (87%); a
Tier-1 index-only row set is 197,958 B. Building on demand costs one pass of ~1,526
`fromRecord()` + a few `cell()` resolutions each — paid once, only if the picker is opened, off
the boot path.

⚠ **Holding 1,526 live `OpenISDDriver`s is not free, and the driver's memoised solve is the
reason.** Each instance carries `#displacedMeta` (a Map), `#listeners` (a Set), and `#cache`,
which on first `cell()` read populates with `{ fields: Record<string, number>, errors }` — the
WHOLE solve for that driver. Empty instances are perhaps 200-300 B each (~0.4 MB total); with
every cache populated by the index build, the resident cost could be several MB. This has not
been measured. Measure it during objective 4 and, if it is large, the answer is to drop the
drivers once the index rows are extracted and re-materialise on click — NOT to reintroduce a
flyweight. Note this interacts with the bundle growing under the 100%-compatible ruling: the
canonical records are fatter than today's flat bag, and they stay resident as each driver's
`#record`.

**Flyweight/cursor — REJECTED** (John, 2026-08-20: "aliasing is a risk, forget the idea — just
create the classes at runtime then and hold in a list for the duration"). Real `OpenISDDriver`
instances are constructed when the index is built and held in a list for as long as the
catalogue is live. No repositioned window, no aliasing hazard, no invalidation protocol.

**Why not a lite interface or the raw JSON:**
(John's ruling 2026-08-20.) The card's numeric fields are CALCULATED, not stored: `readCell`
is literally `OpenISDDriver.fromRecord(record).cell(field)` (`openisdDriver.ts:717`), so every
`_Fs`/`_Sd`/`_Re`/`_Znom`/`_Pe` on a row (`driverRepo.ts:193-200`) is an entered-or-calculated
value only the domain object can resolve, and `classifyTypes` derives `_types`/`_canonical`
from those resolved numbers. Neither a lite interface nor the JSON can produce them.

Resolving them AT RUNTIME is what today's code does, and it does it the expensive way — a
throwaway `OpenISDDriver` per `readCell` call, ~25 per My-Drivers row per re-render. Moving the
resolution to bundle time keeps the domain object as the sole producer while removing the cost
entirely. **My Drivers rows have no bundle**, so they resolve on load instead — once per driver,
cached, not per field per render.

Consequence: **`readCell`/`readMetaCell`/`readDisplayName` should not exist.** They are free
functions taking a RECORD — the JSON entry point the UI currently reaches through. Callers hold
an `OpenISDDriver` and call `.cell()`/`.metaCell()` on it. Deleting them removes
`_OpenISDDriverJson` from `driverRepo`, `myDrivers`, `driverLibrary` and `driverSelection` at
the same time.

**5. STRUCK — the file it targeted no longer exists.** This objective read "`winIsdDriverFileIo.ts`
off the driver JSON". That module was DELETED as redundant, along with its twin
`openIsdDriverFileIo.ts`; neither name appears anywhere in the repo. The `.wdr` read/write path it
described now belongs to objective 6's `FileIO` (see `docs/design/FILEIO_API_PROPOSALS.md`), so
there is nothing separate to do here.

**6. QO61 — `useDesignIO.ts`.** Per `docs/plans/PLAN_USEDESIGNIO_REMEDIATION.md`, revised
against these rules: engine gains the PR inverse formulas, reached ONLY via the objective-3 PR
getter; `.wpr` parsing moves to `@openisd/winisd` raw-only; box-type mapping consolidates to one
enum-typed function; the file shrinks to a `FileIO` service and is renamed.

**10. Tests move to the package whose behaviour they assert.**

`packages/winisd/test/wdr-import-fidelity.test.ts` and `wdr-model-coverage.test.ts` each call
`.cell()` on BOTH a `WinISDDriver` (letters) and an `OpenISDDriver` (`Provenance`), through
same-named local variables, in the format package's test directory. `wdr-model-coverage`'s own
header states its subject as *"every `.wdr` field has a home in the OpenISD model"* — a claim
about `@openisd/model`.

Demonstrated cost: the `CellState` → `Provenance` split (landed 2026-08-21) had to convert every
assertion by which object it read. These two files were got wrong twice; every other file in the
sweep converted correctly first time.

Split by side: format-fidelity assertions stay in `packages/winisd/test`; model-coverage
assertions move to `packages/model/test`. Where a test genuinely needs both objects, name the
variables for their type — `wdrCell` / `driverCell`, never a bare `cell`.
Record: `bugs/BUG_20260821_winisd_tests_assert_model_behaviour_from_the_format_package.md`.

**9. `useDriverCells.ts` dissolves; the `use` prefix stops lying.**

Two defects, both recorded 2026-08-21:

- **`Q_GROUP` is redeclared in the UI** against the engine's explicit ban.
  `consistency.ts:112` DERIVES `Q_GROUP_FIELDS` from the `Qts = Qes·Qms/(Qes+Qms)` relation and
  its comment says "Never redeclare this list elsewhere"; `useDriverCells.ts:40` hardcodes
  `['Qts','Qes','Qms']` as a literal that cannot follow a change to the relation.
  `Q_GROUP` and `useQGroupIncomplete()` (a DOMAIN rule — two of three Q members solve the third)
  leave the UI. What stays is `CellClass` and `cellClassOf()`, genuine presentation, which fold
  into `presentationState.ts` with objective 2b. `consistencyNote()` is borderline: the wording
  is presentation, the rule it formats is not.
  Record: `bugs/BUG_20260821_q_group_redeclared_in_ui_against_the_engines_explicit_ban.md`.

- **`use` names four modules that are not composables.** `useDriverCells` (1 of 5 exports),
  `useDesignIO` (0 — its only export is the FACTORY `createDesignIO`), `useVentGroup`,
  `usePrGroup` (0 — plain functions over explicit arguments). The prefix names the MECHANISM,
  not the subject, and implies a reactivity contract the files do not honour. Rename by subject;
  reserve `use*` for functions that genuinely return reactive state. `useDesignIO.ts` →
  `createFileIO.ts` is already objective 6.
  Record: `bugs/BUG_20260821_use_prefix_names_modules_that_are_not_composables.md`.

**8. Correct the docs that state the model↔winisd dependency BACKWARDS.**

**RULED (John, 2026-08-21): `OpenISDDriver` points at WinISD; WinISD never points back.**
`toWinISDDriver()` stays on `OpenISDDriver`. `packages/model` keeping a runtime dependency on
`@openisd/winisd` is CORRECT — no code moves.

The defect is documentation asserting the reverse:

- `openisdDriver.ts:8-11` claims `@openisd/winisd` "depends on this package and is invisible
  from here". Both halves false — it imports `WinISDDriver`, `INI_ROWS`, `CellState`,
  `WdrCell`/`WdrHeader` on the four lines below that comment.
- `ARCHITECTURE.md:566` states the same wrong direction.
- `winisdDriver.ts:243` names `WinISDDriver.fromOpenISDDriver(driver)` — a method that does not
  exist. Delete.

Still open, separate: `CellState` is declared in `@openisd/winisd` and re-exported by
`@openisd/model` (`openisdDriver.ts:36`), so OpenISD's own entered/calculated/absent concept is
owned by the format package. Not a layering breach under the ruled direction, but needs a
decision — leave it, or declare it in `@openisd/model` and have WinISD import it.

Record: `bugs/BUG_20260820_model_depends_on_winisd_and_re_exports_its_cellstate.md`.

**7. The UI stops importing storage.** With 1–6 done, the `.vue` files take the domain facade or
a service instead. `OriginalShell.vue` (21 names) is the bulk of this and should be last.

## Two findings to record as bugs before touching them

- **The bundle may be out of sync with the model.** `scripts/bundle-drivers.mjs:216` emits
  `record: { inputs }` — a flat T/S bag — while `readCell`/`readDisplayName` call
  `OpenISDDriver.fromRecord()` and read `record.specs[...]`, `record.brand.value`,
  `rec.sku?.value`, none of which exist on that shape. Bundler last changed 2026-08-14, model
  2026-08-19. Inferred from code; NOT runtime-verified — verify before acting.
- **BUG A — `syncedP` calculates inside the store.** `store.ts:485`:
  `const eg = Math.sqrt((state.P.Pin ?? 1) * (engineDriver()?.Re ?? 1))`. The file's OWN header
  (`store.ts:4-12`, John's ruling 2026-08-18) states it "must never CALCULATE a value — not even
  by correctly calling out to a properly single-sourced formula function", and that the fix is
  "adding it there as a getter/method — never computing it here 'just this once'". Precisely the
  forbidden case, in the file that forbids it. Fix: `eg` becomes a getter on the domain object.

- **BUG B — the `filters` deep-copy is a reactivity workaround, not a fix** (John's call,
  2026-08-20). `store.ts:491`: `p.filters = state.P.filters.map(f => ({ ...f }))`.
  **Mechanism:** the `{ ...state.P }` above it shallow-copies, so `filters` crosses as an array
  REFERENCE; the computed therefore depends only on that reference. Editing a filter's
  `fc`/`Q`/`gain` in place mutates the same array, the reference never changes, `syncedP` never
  recomputes, and the sweep silently runs on stale filter values. The deep copy exists only to
  TOUCH every nested field so Vue registers a dependency on each.
  **Why it is a bug and not a solution:** it hides the real defect — a computed hand-rolling its
  own dependency tracking over a mutable structure it should not be reaching into — and it
  allocates N fresh objects on every recompute, on the path that feeds the sweep. Per the
  no-workarounds rule the cause gets fixed, not the symptom: the filters come from the domain
  object as a properly-tracked value.
  Both bugs need a `bugs/BUG_*.md` record written before either is touched.

## Sequencing

1 → 2 are independent and safe (deletions + mechanical repointing). 3 unblocks 6. 4 is
independent of all of them. 5 is small. 7 is last, and largest.

**QO56 hazard:** `store.ts`, `managedProject.ts`, `openisdDriver.ts` and `winisdDriver.ts` are
all named on the concurrent-edit list, and this plan touches every one. Confirm no peer session
holds them before starting each objective.

## Verification

`npm run lint` 0 warnings · `npm run typecheck` clean · `npx vitest run` all green including all
four `architecture.test.ts` gates. Per objective: typecheck after 1–2, model suite after 3,
picker browser spec after 4, `winisd` suite after 5, `useDesignIO`/`wpr` suites after 6, full
Playwright run after 7.

## Already landed this session

Envelope kinds merged into `openisdDriver.ts` beside their JSON shape (model 56/56, typecheck
clean) · `store.ts`'s `_projectToPersist` un-exported · `_OpenISDProjectJsonPrivateAllow`
created (it had none) · `managedProject` grants recorded then reverted per the ManagedX ruling ·
`wpr.test.ts` repointed onto the WinISD-generated golden, with the phantom-vent divergence it
exposed recorded as a bug rather than deleted from the test.
