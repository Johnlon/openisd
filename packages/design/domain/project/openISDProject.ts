import {LossMode} from '../../fields/lossMode.js';
import {type Engine} from '../../engine/index.js';
import type { Air, AirEnvironment, BoxParamsIssue, ChartId, DriverError, Filter, MaxCurvesResult, MaxCurvesSolveResult, SweepResult, SweepSolveResult } from '../../engine/index.js';
import { dateStamp, realAppContext } from '../appContext.js';
import type { AppContext } from '../appContext.js';
import { focus, simpleField } from '../cell.js';
import type { Calculatable, Calculated, Clearable, Entered, Readable, SimpleField, Unsolvable, Writable } from '../cell.js';
import { newUuid } from '../newUuid.js';
import type { OpenISDProjectJson, OpenISDProjectSessionJson } from '../openisdSchema.js';
import type { Box } from '../box/box.js';
import type { FrequencyGrid } from '../box/frequencyGrid.js';
import { OpenISDBox } from '../box/openISDBox.js';
import { OpenISDDriver } from '../driver/openISDDriver.js';
import { OpenISDDriverEmbedded } from '../driver/openISDDriverEmbedded.js';
import type { DiscardChallenge } from './discardChallenge.js';
import type { DragRange } from './dragRange.js';
import { ProjectAdvanced } from './projectAdvanced.js';
import { ProjectChartsView, type OpenCharts } from './projectChartsView.js';
import { ProjectEnvironment, envFieldsOver } from './projectEnvironment.js';
import { owprTextOf, parseOwprSession, parseOwprSessionRepairing, sessionOf, withoutDriverId } from './projectSerialization.js';
import type { FieldPath } from '../schemaRepair.js';
import { boxParamsIssuesOf, maxCurvesOf, sweepOf, sweepPlanOf, ventAchievedFbOf, ventMaxReachableFbOf } from './projectSweep.js';
import type { ProjectSweepSource, SweepPlan } from './projectSweep.js';
import { freshEmbeddedDriver } from './freshEmbeddedDriver.js';
import type { ProjectIssues } from './projectIssues.js';
import { ProjectMeta } from './projectMeta.js';
import { ProjectListeners } from './projectListeners.js';
import { resolveProject, usableRe } from './projectResolve.js';
import { ProjectSignal } from './projectSignal.js';

// The domain declares its state here. JSON shapes live in `openisdSchema.ts`.
// Internal JSON types are never re-exported from `domain/index.ts`.
//
// A module-scoped WeakMap bridge (`notifyProject`/`subscribeToProject`) lets
// `ManagedProject` observe internal `OpenISDProject` changes without exposing
// state publicly.
//
// This class holds the record (`#saved`/`#edited`/`#whatif`/`#engine` — see
// `architecture-project-has-three-fields.test.ts`) and the public surface built fresh from it on
// every access, same as `driver`/`box` always have. Responsibility split across sibling modules
// by area (PLAN_openisdproject_split.md): `projectResolve.ts` (the solve cascade),
// `projectMeta.ts` (name/creator/description), `projectEnvironment.ts` (temp/humidity/pressure),
// `projectSignal.ts` (drive power/voltage), `projectAdvanced.ts` (filters and the WinISD
// compatibility switches), `projectChartsView.ts` (which charts, trace colour, sweep N),
// `projectSerialization.ts` (.wpr/.owpr text), `projectSweep.ts` (the engine sweep/max-curves
// call and its enclosure/box-specific parameter building). Each is built fresh over a lens/source
// this class hands it, never held as a stored collaborator — `cursorF`/`pinnedF`/`cursorLocked`/
// `dragRange` are the one documented exception, staying as this class's own private fields.

/** The port-velocity limit line where a project does not state one. */
const DEFAULT_PORT_VELOCITY_LIMIT_M_PER_S = 17;

export class OpenISDProject {
    /** THE project's identity, and IN-MEMORY ONLY — deliberately a class field rather than a
     *  member of `OpenISDProjectJson`, which is what makes "internal only" structural instead of
     *  a rule someone has to remember: the record is the only thing that is ever serialised, so
     *  an id that is not in it CANNOT reach a file or a link (John 2026-08-26, QO92).
     *
     *  It exists so the running app can tell two open projects apart when their names collide,
     *  and so a store — or a focus pointer — can key on something stable. */
    readonly #uuid: string;

    /** The project as of the last save. Never mutated: every write builds a new record. */
    #saved: OpenISDProjectJson;

    /** The project including every change since the last save, or null when no change has been
     *  made. Always a COMPLETE record, never a partial one. */
    #edited: OpenISDProjectJson | null = null;

    /** The transient tuning session. It is never promoted or serialized. */
    #whatif: OpenISDProjectJson | null = null;

    readonly #listeners = new ProjectListeners();

    /** The one calculation surface this project uses. INJECTED — never constructed here, never
     *  reached through a module-scoped instance. Every acoustic figure the project reports comes
     *  from this reference and from nowhere else. */
    readonly #engine: Engine;

    /** The clock `modified` is stamped from. */
    readonly #appContext: AppContext;

    /** The current layer's cached issues — see the class doc comment's "ONE EXCEPTION". */
    #issues: ProjectIssues = { driver: [], signal: [], vent: [], pr: [], sealed: [], ventTuningExtra: null };

    private constructor(saved: OpenISDProjectJson, uuid: string, engine: Engine, appContext: AppContext) {
        this.#saved = saved;
        this.#uuid = uuid;
        this.#engine = engine;
        this.#appContext = appContext;
        this.#resolve();
    }

    /** A window onto a driver embedded in `root`'s whole record — `get driver()` below is
     *  `#driverOver(this.#root())`; `#resolve()` calls it with a DIRECT (non-notifying) root of
     *  its own instead. One construction, parameterised by which lens backs it. */
    #driverOver(root: SimpleField<OpenISDProjectJson>): OpenISDDriverEmbedded {
        return OpenISDDriverEmbedded.wrap(
            focus(focus(root, 'driverEmbedding'), 'device'),
            this.#engine,
            () => this.#airOver(root),
            () => this.#issues.driver,
        );
    }

    /** The project's own resolved `{rho, c}` — the ONE air every calculation uses: box, vent, PR,
     *  resolve, sweep, "Use WinISD driver calculations" taking Cms from Vas. The embedded
     *  driver's own `c_m_per_s`/`roo_kg_per_m3` are never a source for this — see the field
     *  comment on `OpenIsdDriverSpec`'s constructor. */
    #air(root: SimpleField<OpenISDProjectJson>): Air {
        return this.#engine.environment.solve(this.#airOver(root)).values;
    }

    /** The four air conditions `root` reads as — each E or C, never absent. */
    #airOver(root: SimpleField<OpenISDProjectJson>): AirEnvironment {
        const env = envFieldsOver(focus(root, 'environment'), this.#engine.environment);
        return {
            tempK: env.tempK.value, humidityPct: env.humidityPct.value, pressurePa: env.pressurePa.value,
            useWinisdAirModel: root.value.environment.useWinisdAirModel ?? true,
        };
    }

    /** The embedded driver — built fresh from the current record on every access, never held: the
     *  project has exactly three stored fields (`#saved`/`#edited`/`#engine`, John 2026-09-06;
     *  `#issues` is a derived cache, not project state — see
     *  the class doc comment), and every other public member is a getter mirroring the record's
     *  own structure. */
    get driver(): OpenISDDriverEmbedded {
        return this.#driverOver(this.#root());
    }

    /** A window onto the box embedded in `root`'s whole record — `get box()` below is
     *  `#boxOver(this.#root())`; `#resolve()` calls it with a DIRECT (non-notifying) root of its
     *  own instead. Mirrors `#driverOver` exactly (S2-7d2). */
    #boxOver(root: SimpleField<OpenISDProjectJson>): OpenISDBox {
        return OpenISDBox.wrap(
            focus(root, 'box'), this.#driverOver(root), this.#engine,
            () => root.value.driverEmbedding.Rs_ohm,
            () => LossMode.parse(root.value.advanced.lossMode),
            () => this.#issues,
            () => this.#issues.ventTuningExtra,
            () => this.#air(root),
        );
    }

    /** Replace the embedded driver's whole record with `source`'s — the project adopting a
     *  different driver (choosing one from the library, loading a `.wdr`/`.owdr` file).
     *  Array-level facts (`nDrivers`, `wiring`, ...) are untouched; only `driverEmbedding.device`
     *  changes. */
    setDriver(source: OpenISDDriver): void {
        this.driver.update(source.copyAsNew());
    }

    /** Adopt a driver that came from outside this project — a library pick, or a `.wdr`/`.owdr`
     *  file just parsed. Same write as `setDriver`, with a name that says where the driver came
     *  from. Deep-clones — the file's/library's driver and this project's share no nested object
     *  afterward. */
    loadDriver(source: OpenISDDriver): void {
        if (source instanceof OpenISDDriverEmbedded) {
            throw new Error('loadDriver(): source must be a standalone OpenISDDriver, not an embedded project driver');
        }
        this.driver.update(source.copyAsNew());
    }

    /** How many units of the embedded driver this project's array uses, and how they're wired
     *  together — array-level facts, not facts about the driver itself (John 2026-09-06). */
    get nDrivers(): SimpleField<number> {
        return focus(this.#slot('driverEmbedding'), 'nDrivers');
    }

    get wiring(): SimpleField<'series' | 'parallel'> {
        return focus(this.#slot('driverEmbedding'), 'wiring');
    }

    /** Thermal power compression: coil temperature rise under drive, Kelvin. */
    get vcTempRise_K(): SimpleField<number> {
        return focus(this.#slot('driverEmbedding'), 'vcTempRise_K');
    }

    /** The amplifier's own source/output resistance loading this array. */
    get Rs_ohm(): SimpleField<number> {
        return focus(this.#slot('driverEmbedding'), 'Rs_ohm');
    }

    /** Mass this project's array adds to the driver — its own hardware, not a fact about the
     *  driver itself. */
    get driverAddedMass_kg(): SimpleField<number> {
        return focus(this.#slot('driverEmbedding'), 'driverAddedMass_kg');
    }

    /** This array's own voice-coil resistance temperature coefficient, SI 1/K — independent of
     *  the driver's own datasheet `driver.alfaVC_per_K` (WinISD stores these separately, and
     *  they can diverge). */
    get alfaVC_per_K(): SimpleField<number> {
        return focus(this.#slot('driverEmbedding'), 'alfaVC_per_K');
    }

    /** WinISD Driver tab "Standard" / "Iso-Barik" radio. */
    get loading(): SimpleField<'standard' | 'isobaric'> {
        return focus(this.#slot('driverEmbedding'), 'loading');
    }

    /** The box — handed the DRIVER and the ENGINE: a chamber's resonance depends on the driver it
     *  loads, and the box reads the driver through its PUBLIC field surface, never its record.
     *  Built fresh on every access, same reasoning as `driver`. */
    get box(): Box {
        return this.#boxOver(this.#root());
    }

    /** The port air velocity, m/s, every port-velocity chart draws as its limit line. 17 m/s
     *  where the project does not say. Whether WinISD has such a setting is unverified. */
    get portVelocityLimit_m_per_s(): SimpleField<number> {
        const lens = focus(this.#slot('box'), 'portVelocityLimit_m_per_s');
        return {
            get value() { return lens.value ?? DEFAULT_PORT_VELOCITY_LIMIT_M_PER_S; },
            set: (v: number) => lens.set(v),
        };
    }

    /** This project's metadata window, built fresh on every access — same reasoning as
     *  `driver`/`box` above. */
    #meta(): ProjectMeta {
        return ProjectMeta.wrap(this.#slot('meta'));
    }

    /** What the user calls this project. A LABEL, not an identity — two projects may share one,
     *  which is exactly why `uuid()` exists. */
    get name(): SimpleField<string> {
        return this.#meta().name;
    }

    /** The name a layout shows for this project: its own name, else its driver's brand and model. */
    title(): string {
        const name = this.name.value;
        if (name) return name;
        return [this.driver.brand.value, this.driver.model.value].filter(x => x.length > 0).join(' ');
    }

    /** WinISD Project tab: who made this project, and when. */
    get creator(): SimpleField<string> {
        return this.#meta().creator;
    }

    get created(): SimpleField<string> {
        return this.#meta().created;
    }

    get modified(): SimpleField<string> {
        return this.#meta().modified;
    }

    /** WinISD Project tab: the user's own note about this project. Stored, never interpreted. */
    get description(): Readable<string> & Entered & Writable<string> {
        return this.#meta().description;
    }

    /** The signal-chain filter list. */
    get filters(): SimpleField<readonly Filter[]> {
        return ProjectAdvanced.wrap(this.#slot('advanced'), this.#slot('filters')).filters;
    }

    /** Force-flat auto-EQ — WinISD Advanced "Force flat response". */
    get forceFlatResponse(): SimpleField<boolean> {
        return ProjectAdvanced.wrap(this.#slot('advanced'), this.#slot('filters')).forceFlatResponse;
    }

    /** Model ports as a lossy transmission line instead of a lumped mass — WinISD Advanced
     *  "Use transmission line-model for port simulation". */
    get useTransmissionLinePortModel(): SimpleField<boolean> {
        return ProjectAdvanced.wrap(this.#slot('advanced'), this.#slot('filters')).useTransmissionLinePortModel;
    }

    /** WinISD Advanced "Rg is at driver side" — whether the amplifier's source resistance
     *  (`Rs_ohm`) is applied per driver or once across the whole array. */
    get rgAtDriverSide(): SimpleField<boolean> {
        return ProjectAdvanced.wrap(this.#slot('advanced'), this.#slot('filters')).rgAtDriverSide;
    }

    /** WinISD Advanced "Simulate voice coil inductance" — includes Le in the acoustic circuit
     *  model (gyrator) rather than just the impedance plot (winisd). 'winisdGyrator' is WinISD's
     *  own inductance-on model. */
    get circuitModel(): SimpleField<'winisd' | 'gyrator' | 'winisdGyrator'> {
        return ProjectAdvanced.wrap(this.#slot('advanced'), this.#slot('filters')).circuitModel;
    }

    /** WinISD Advanced "SPL graph is Xmax limited" — whether the SPL chart shows the
     *  Xmax-backed-off curve instead of the unclamped one. Display only. */
    get splGraphIsXmaxLimited(): SimpleField<boolean> {
        return ProjectAdvanced.wrap(this.#slot('advanced'), this.#slot('filters')).splGraphIsXmaxLimited;
    }

    /** Sealed-box resonance loss model (S10/QO130) — which physics model `box.sealed`'s Fsc/Qtc
     *  readout uses. PROJECT-scoped, not a UI singleton: two open projects must not share one
     *  loss mode. `advanced.lossMode` stores the wire string; this is the one boundary that
     *  translates it via `LossMode.parse`/`.value`, matching the `circuitModel` accessor above. */
    get lossMode(): SimpleField<LossMode> {
        return ProjectAdvanced.wrap(this.#slot('advanced'), this.#slot('filters')).lossMode;
    }

    /** WinISD Advanced / Compatibility "Use WinISD driver calculations" — whether engine sweeps
     *  substitute the driver WinISD's own simulation acts on, `Mms = 1/((2π·Fs)²·Cms)`,
     *  `Rms = 2π·Fs·Mms/Qms` and `BL = √(Re/(2π·Fs·Qes·Cms))`, for entered values that conflict
     *  with them (measured 2026-09-26, docs/research/WINISD_PARITY.md). On where a project does
     *  not say, per the README: untouched, OpenISD gives WinISD's answer. */
    get winisdDriverModel(): SimpleField<boolean> {
        return ProjectAdvanced.wrap(this.#slot('advanced'), this.#slot('filters')).winisdDriverModel;
    }

    /** WinISD Compatibility "WinISD VA model": the amplifier apparent load power chart as WinISD
     *  computes it, P·Re·|Hf|²/|Z + Rg| (BUG_20260927_winisd-va-uses-re-not-re-plus-rg). Off: the
     *  apparent power the amplifier delivers, P·(Re + Rg)·|Hf|²/|Z_amp|. On where a project does
     *  not say. */
    get winisdVaModel(): SimpleField<boolean> {
        return ProjectAdvanced.wrap(this.#slot('advanced'), this.#slot('filters')).winisdVaModel;
    }

    /** WinISD Compatibility "WinISD driver count" — see `ProjectAdvanced.winisdDriverCountModel`. */
    get winisdDriverCountModel(): SimpleField<boolean> {
        return ProjectAdvanced.wrap(this.#slot('advanced'), this.#slot('filters')).winisdDriverCountModel;
    }

    /** WinISD Compatibility "WinISD flat response" — see `ProjectAdvanced.winisdFlatModel`. */
    get winisdFlatModel(): SimpleField<boolean> {
        return ProjectAdvanced.wrap(this.#slot('advanced'), this.#slot('filters')).winisdFlatModel;
    }

    /** Sets every WinISD-vs-conventional compat switch to WinISD. Native WinISD controls (voice
     *  coil inductance on/off, "Rg is at driver side") and project data keep their values. */
    applyWinisdSettings(): void {
        this.lossMode.set(LossMode.parse('winisd-lossy'));
        this.envUseWinisdAirModel.set(true);
        this.winisdDriverModel.set(true);
        this.winisdVaModel.set(true);
        this.winisdDriverCountModel.set(true);
        this.winisdFlatModel.set(true);
    }

    /** Which charts are open (S10/QO130) — PROJECT-scoped, reversing QO90 for this field.
     *  Empty when absent (a project saved before S10, or a fresh one). Plain strings, not
     *  `ChartId`: this is PERSISTED project data (`.owpr`), so it must stay readable across a
     *  version skew that adds/removes chart ids — `parseChartId` (packages/ui `logic/series.ts`)
     *  does the string↔member conversion at the UI boundary. */
    get graphs(): SimpleField<readonly string[]> {
        return new ProjectChartsView(this.#slot('charts'), this.#engine.box, () => this.box.boxType.value).graphs;
    }

    /** Which charts this project's box type shows, in WinISD's own chart-menu order — a design
     *  decision, not a UI one (bugs/BUG_20260927_winisd-charts-missing.md): port charts only
     *  for a ported box, PR charts only for a radiator, the ten system charts and the three
     *  EQ/filter charts always. The UI shows exactly the ids this returns, never a second list
     *  of "which charts apply". */
    get charts(): readonly ChartId[] {
        return new ProjectChartsView(this.#slot('charts'), this.#engine.box, () => this.box.boxType.value).charts;
    }

    /** The charts shown at once, stacked (see `OpenCharts`). */
    get openCharts(): OpenCharts {
        return new ProjectChartsView(this.#slot('charts'), this.#engine.box, () => this.box.boxType.value).openCharts;
    }

    /** The graph cursor/selection (S10/QO130) — PROJECT-scoped, reversing QO90: two open
     *  projects must not share one cursor. Written on every mousemove during hover/drag, so
     *  QO168 (John 2026-09-21) keeps these four OUT of the saved record entirely: plain private
     *  instance fields, never `OpenISDProjectJson`/`.owpr` (unlike `graphs`/`lossMode` above,
     *  which DO persist) — a documented exception in
     *  `architecture-project-has-three-fields.test.ts`. `#notify()` alone on write — no
     *  `#slot()`, no `#edited` clone, no `#resolve()` cascade; a mousemove has nothing for the
     *  solver to recompute. */
    #cursorF: number | null = null;
    #pinnedF: number | null = null;
    #cursorLocked = false;
    #dragRange: DragRange | null = null;

    get cursorF(): SimpleField<number | null> {
        return simpleField(() => this.#cursorF, (v) => { this.#cursorF = v; this.#notify(); });
    }

    /** The crosshair's pinned/snapped frequency — see `cursorF` above. */
    get pinnedF(): SimpleField<number | null> {
        return simpleField(() => this.#pinnedF, (v) => { this.#pinnedF = v; this.#notify(); });
    }

    /** Whether the crosshair is locked to `pinnedF` rather than following the pointer. */
    get cursorLocked(): SimpleField<boolean> {
        return simpleField(() => this.#cursorLocked, (v) => { this.#cursorLocked = v; this.#notify(); });
    }

    /** The dragged frequency-band selection, or null when none is active. */
    get dragRange(): SimpleField<DragRange | null> {
        return simpleField(() => this.#dragRange, (v) => { this.#dragRange = v; this.#notify(); });
    }

    /** The project's trace/legend colour (a CSS colour), saved in the project file; null until
     *  first assigned. Chart view state, so `isModified()` ignores it. */
    get traceColor(): SimpleField<string | null> {
        return new ProjectChartsView(this.#slot('charts'), this.#engine.box, () => this.box.boxType.value).traceColor;
    }

    /** Give the project its trace colour as ground state: written to the saved record, and to the
     *  unsaved edits when there are any, so being given a colour is never itself an unsaved change
     *  and every tab stores the same record. */
    stampTraceColor(color: string): void {
        const coloured = (json: OpenISDProjectJson): OpenISDProjectJson => ({...json, charts: {...json.charts, traceColor: color}});
        this.#saved = coloured(this.#saved);
        if (this.#edited) this.#edited = coloured(this.#edited);
        if (this.#whatif) this.#whatif = coloured(this.#whatif);
        this.#notify();
    }

    get sweepN(): SimpleField<number | null> {
        return new ProjectChartsView(this.#slot('charts'), this.#engine.box, () => this.box.boxType.value).sweepN;
    }

    /** A record ENTERS the process here. A record carries no identity, so one is minted — two
     *  wraps of one record are two independently editable projects, which is what opening a FILE
     *  twice should give. */
    static wrap(json: OpenISDProjectJson, engine: Engine, appContext: AppContext = realAppContext): OpenISDProject {
        return this.wrapWithIdentity(freshEmbeddedDriver(json, appContext), appContext.newId(), engine, appContext);
    }

    /**
     * Wrap a record under an identity the caller already holds. FOR A STORE READ, AND NOTHING
     * ELSE: a store key was minted in this process, so adopting it back is restoring an identity,
     * not importing a foreign one. Without this, a project loaded from the store gets a new
     * identity and its next save writes to a NEW key, orphaning the entry it came from
     * (`bugs/BUG_20260826_reopening_a_stored_project_duplicates_its_store_entry.md`).
     *
     * NOT for a file: a file's id was minted by another process and is provenance, never a key
     * (the driver precedent, QO81).
     */
    static wrapWithIdentity(json: OpenISDProjectJson, uuid: string, engine: Engine, appContext: AppContext = realAppContext): OpenISDProject {
        return new OpenISDProject(json, uuid, engine, appContext);
    }

    /** Wrap a stored session (saved and edited states) under an adopted identity. */
    static wrapSession(session: OpenISDProjectSessionJson, uuid: string, engine: Engine, appContext: AppContext = realAppContext): OpenISDProject {
        const project = new OpenISDProject(freshEmbeddedDriver(session.saved, appContext), uuid, engine, appContext);
        if (session.edited) {
            project.#edited = freshEmbeddedDriver(session.edited, appContext);
            // The constructor's own resolve() only reached `#saved`, set just above — the
            // edited layer just assigned needs its own (S7-d: recompute on load).
            project.#resolve();
        }
        return project;
    }

    /** This project's in-memory identity. */
    uuid(): string {
        return this.#uuid;
    }

    /** The committed/ordinary-edit record. What-if never becomes the persistence source. */
    #committed(): OpenISDProjectJson {
        return this.#edited ?? this.#saved;
    }

    /** The record every live project read goes to. */
    #current(): OpenISDProjectJson {
        return this.#whatif ?? this.#committed();
    }

    /** Enter the edited state if not already in it, and answer the record a write must build on. */
    #ensureEditing(): OpenISDProjectJson {
        if (!this.#edited) this.#edited = structuredClone(this.#saved);
        return this.#edited;
    }

    /** A get/set pair addressing ONE top-level field of the record. Reads whichever record is
     *  current; every write lands in the active what-if, otherwise in `#edited`.
     *
     *  The write REPLACES the record rather than mutating one, so a caller holding an earlier
     *  record sees no change through it — copy-on-write, with the copy being the spread that a
     *  write performs anyway. */
    #slot<K extends keyof OpenISDProjectJson>(key: K): SimpleField<OpenISDProjectJson[K]> {
        return simpleField(() => this.#current()[key], (value) => {
            const base = this.#whatif ?? this.#ensureEditing();
            if (this.#whatif) this.#whatif = {...base, [key]: value};
            else this.#edited = this.#stampModified(base, {...base, [key]: value});
            this.#resolve();
            this.#notify();
        });
    }

    /** `next` with `meta.modified` stamped from the app context's clock when the write it carries
     *  is the one that takes the project from saved to having unsaved changes. Later writes leave
     *  the stamp alone until the next save. A write to `modified` itself is kept as written; a
     *  chart-view write is not a change (`isModified()`). */
    #stampModified(before: OpenISDProjectJson, next: OpenISDProjectJson): OpenISDProjectJson {
        if (next.meta.modified !== before.meta.modified) return next;
        const wasModified = this.isModified();
        this.#edited = next;
        if (wasModified || !this.isModified()) return next;
        return {...next, meta: {...next.meta, modified: dateStamp(this.#appContext.now())}};
    }

    /** A get/set pair over the WHOLE current record — what `get driver()` builds its embedded
     *  driver window on, since a driver's own fields nest many levels below any single top-level
     *  `OpenISDProjectJson` key and `#slot` only ever addresses one. Promotes/notifies exactly
     *  like `#slot` (S2-7d1: also resolves before it notifies), for the same reason: a nested
     *  `focus()` write always reads the whole object a lens is over, then replaces it whole —
     *  here that whole object is the entire project record. */
    #root(): SimpleField<OpenISDProjectJson> {
        return simpleField(() => this.#current(), (json) => {
            if (this.#whatif) this.#whatif = json;
            else this.#edited = this.#stampModified(this.#ensureEditing(), json);
            this.#resolve();
            this.#notify();
        });
    }

    /**
     * T11/S2-7d: resolve the CURRENT layer and cache the result in `#issues`. The actual solve
     * lives in `resolveProject` (`./projectResolve.js`) — reads and writes go DIRECTLY to the
     * layer object below, never through `#slot`/`#root`: those always promote to `#edited` and
     * notify, which would make simply LOADING a project (`wrap()`) register as "modified", and
     * would make a solve's OWN writes notify a SECOND time for one user action — the exact
     * write-on-read/write-on-solve loop that broke `OpenISDDriverEmbedded` in S2-7c before its
     * own auto-resolve was pulled out of the shared driver constructor (see that class's own
     * note). `driverOver`/`boxOver`/`air`/`envFieldsOver`/`powerDriveOver`/`driveVoltageOver` are
     * passed in as closures rather than let `resolveProject` reach `this`: they are this
     * project's own window-builders, shared with the live getters below (S2-7d2).
     */
    #resolve(): void {
        const directRoot = simpleField<OpenISDProjectJson>(
            () => this.#whatif ?? this.#edited ?? this.#saved,
            (json) => {
                if (this.#whatif) this.#whatif = json;
                else if (this.#edited) this.#edited = json;
                else this.#saved = json;
            });
        this.#issues = resolveProject({
            directRoot,
            engine: this.#engine,
            driverOver: (root) => this.#driverOver(root),
            boxOver: (root) => this.#boxOver(root),
            air: (root) => this.#air(root),
            envFieldsOver: (environment) => envFieldsOver(environment, this.#engine.environment),
            powerDriveOver: (root) => this.#signalOver(root).powerDrive_W,
            driveVoltageOver: (root) => this.#signalOver(root).driveVoltage_V,
        });
    }

    /** @internal The record a save writes, deep-cloned — the persisted payload's one route to
     *  this project's state, never field by field. Reads `#saved`, NEVER `#edited`: a file/share
     *  write must never persist unsaved changes on its own — `save()` is a distinct, explicit
     *  user action (the Save button), and this method must not promote `#edited` to `#saved` as a
     *  side effect of being called. A caller writing out an edited project calls `save()` first,
     *  itself, in response to the user's own action. Clones before handing it out, so the stored
     *  copy cannot drift when this project is edited afterward — a shallow `{...}` spread is not
     *  enough, since every nested field object (`box`, `driver`, `environment`, …) would still be
     *  the same reference as the live record. No code outside `packages/design` may call this. */
    cloneSavedProject(): OpenISDProjectJson {
        return structuredClone(this.#saved);
    }

    /** An independent project holding this one's committed state — the edited layer, or the
     *  saved one when nothing is edited — under the same identity, with no what-if. A snapshot for
     *  an export or a comparison: the converter that reads it keeps no hold on this project. */
    committedSnapshot(): OpenISDProject {
        return OpenISDProject.wrapWithIdentity(structuredClone(this.#committed()), this.#uuid, this.#engine, this.#appContext);
    }

    /** This project as `.owpr` text — openisd project JSON, the form
     *  `OpenISDProject.fromOwprText` reads back. Carries the saved state, the edited state and
     *  the name, so reopening the file restores unsaved edits exactly as they were.
     *
     *  Lossless, unlike `toWprText()`: this is openisd's own format, so there is nothing to drop
     *  and no error to report. */
    toOwprText(): string {
        return owprTextOf(this.cloneSession());
    }

    /** `.owpr` text back to a project, or everything wrong with the text. The inverse of
     *  `toOwprText()`.
     *
     *  The project takes a FRESH identity: a file's contents are provenance, not a store key
     *  (QO81), so opening the same file twice yields two independently addressable projects. */
    static fromOwprText(text: string, engine: Engine): OpenISDProject | string[] {
        const parsed = parseOwprSession(text);
        if ('errors' in parsed) return parsed.errors;
        return OpenISDProject.wrapSession(parsed.session, newUuid(), engine);
    }

    /** Whether two `.owpr` texts state the same project, the embedded driver's per-read id aside.
     *  Unreadable text is never the same as anything. */
    static sameOwprText(a: string, b: string): boolean {
        if (a === b) return true;
        const x = parseOwprSession(a);
        const y = parseOwprSession(b);
        if ('errors' in x || 'errors' in y) return false;
        return JSON.stringify(withoutDriverId(x.session)) === JSON.stringify(withoutDriverId(y.session));
    }

    /** Like `fromOwprText`, but a field that fails the schema is removed so its default applies
     *  instead of refusing the project; `repaired` names every field that was reset, for the
     *  user to be told. Refused only when the text is not a project at all. */
    static fromOwprTextRepairing(text: string, engine: Engine): { project: OpenISDProject; repaired: readonly FieldPath[] } | string[] {
        const parsed = parseOwprSessionRepairing(text);
        if (Array.isArray(parsed)) return parsed;
        return { project: OpenISDProject.wrapSession(parsed.value, newUuid(), engine), repaired: parsed.repaired };
    }

    /** Serialises saved and ordinary edited states for persistence. The transient what-if is absent. */
    cloneSession(): OpenISDProjectSessionJson {
        return sessionOf(this.#committed().meta.name, this.#saved, this.#edited);
    }

    /** Whether unsaved changes exist. `charts` (chart zoom/sweep range) is excluded: dragging a
     *  chart axis writes through the same `#slot().set()` path as every other field, but it is
     *  view state, not a change the user should be asked to save — see BACKLOG.md "Round-trip
     *  chart view state". Every other field still counts. */
    isModified(): boolean {
        if (!this.#edited) return false;
        const {charts: _editedCharts, ...editedRest} = this.#edited;
        const {charts: _savedCharts, ...savedRest} = this.#saved;
        return JSON.stringify(editedRest) !== JSON.stringify(savedRest);
    }

    // ── THE SIGNAL ────────────────────────────────────────────────────────────────────────────

    /** This project's signal window, built over `root` — `#resolve()` writes through its direct
     *  root, same split `driverOver`/`boxOver` have (S2-7d2). `usableRe`/`Rs_ohm`/`#issues.signal`
     *  are this project's own facts, passed in rather than let `ProjectSignal` reach for them. */
    #signalOver(root: SimpleField<OpenISDProjectJson>): ProjectSignal {
        return new ProjectSignal(
            focus(root, 'signal'),
            this.#engine.signal,
            () => usableRe(root, (r) => this.#driverOver(r)),
            () => this.Rs_ohm.value ?? 0,
            () => this.#issues.signal,
        );
    }

    /** The drive power — WinISD's Signal-tab "Input Power". While the driver has a usable Re,
     *  `power_W = voltage_V² / Re` holds and whichever of the pair was entered last is entered;
     *  the other is calculated. Without a usable Re it is not available and cannot be entered —
     *  its dq names the missing Re. */
    get powerDrive_W(): Readable<number | null> & Entered & Calculated & Writable<number> & Clearable & Calculatable<number> & Unsolvable {
        return this.#signalOver(this.#root()).powerDrive_W;
    }

    /**
     * The drive voltage — the `eg` every sweep runs at. Never absent: an empty slot reads
     * the default as calculated, and it is never below 10 mV. Entering it needs no Re.
     * `.clear()` empties the
     * pair; the resolve then fills it back from its defaults.
     */
    get driveVoltage_V(): Readable<number> & Entered & Calculated & Writable<number> & Clearable & Calculatable<number> {
        return this.#signalOver(this.#root()).driveVoltage_V;
    }

    // ── ENVIRONMENT ───────────────────────────────────────────────────────────────────────────

    /** This project's air temperature, WinISD Advanced "Temperature". E when typed, else C: the
     *  app's Options → Environment value (`Engine.envDefaults()`), which the resolve also stores. */
    get envTempK(): Readable<number> & Entered & Calculated & Writable<number> & Clearable & Calculatable<number> {
        return new ProjectEnvironment(this.#slot('environment'), this.#engine.environment).tempK;
    }

    /** @deprecated Use `project.envTempK.set(tempK)` instead. */
    setEnvTempK(tempK: number): void {
        this.envTempK.set(tempK);
    }

    /** This project's relative humidity, WinISD Advanced "Humidity". Stored the same way as
     *  `envTempK`. */
    get envHumidityPct(): Readable<number> & Entered & Calculated & Writable<number> & Clearable & Calculatable<number> {
        return new ProjectEnvironment(this.#slot('environment'), this.#engine.environment).humidityPct;
    }

    /** @deprecated Use `project.envHumidityPct.set(humidityPct)` instead. */
    setEnvHumidityPct(humidityPct: number): void {
        this.envHumidityPct.set(humidityPct);
    }

    /** This project's atmospheric pressure, WinISD Advanced "Pressure". Stored the same way as
     *  `envTempK`. */
    get envPressurePa(): Readable<number> & Entered & Calculated & Writable<number> & Clearable & Calculatable<number> {
        return new ProjectEnvironment(this.#slot('environment'), this.#engine.environment).pressurePa;
    }

    /** @deprecated Use `project.envPressurePa.set(pressurePa)` instead. */
    setEnvPressurePa(pressurePa: number): void {
        this.envPressurePa.set(pressurePa);
    }

    /** Which air formula this project's sweeps use — WinISD's parity model when true, OpenISD's
     *  physical CIPM-2007 model when false. Null reads as true (QO95): a new project matches
     *  WinISD out of the box. See `engine/air.ts` for the two models. */
    get envUseWinisdAirModel(): SimpleField<boolean> {
        return new ProjectEnvironment(this.#slot('environment'), this.#engine.environment).useWinisdAirModel;
    }

    /** @deprecated Use `project.envUseWinisdAirModel.set(useWinisdAirModel)` instead. */
    setEnvUseWinisdAirModel(useWinisdAirModel: boolean): void {
        this.envUseWinisdAirModel.set(useWinisdAirModel);
    }

    // ── SIMULATION — the engine's sweep, run on THIS project's driver and box ──────────────────
    //
    // Everything the engine's `SweepParams` needs beyond the frequency grid is already stored
    // somewhere on this project's own record — the box's volume/vent/losses/PR-chamber fields,
    // the driver embedding's wiring/count/thermal fields, the Advanced-tab settings. A caller
    // asking for a sweep supplies only what it actually decides: the grid to sweep over. Passing
    // any of the rest back in would let a caller override a fact the project already states about
    // itself, which is the thing John's 2026-09-06 ruling rules out.

    /** Everything `projectSweep.ts`'s free functions need to read off this project — built fresh
     *  on every sweep/maxCurves/boxParamsIssues/ventAchievedFb/ventMaxReachableFb call, same
     *  reasoning as `driver`/`box` (PLAN_openisdproject_split.md module 8). A structural
     *  interface, not `OpenISDProject` itself, so `projectSweep.ts` never imports this class back. */
    #sweepSource(): ProjectSweepSource {
        const root = this.#root();
        return {
            driver: this.driver,
            box: this.box,
            nDrivers: this.nDrivers,
            wiring: this.wiring,
            Rs_ohm: this.Rs_ohm,
            circuitModel: this.circuitModel,
            winisdDriverModel: this.winisdDriverModel,
            winisdVaModel: this.winisdVaModel,
            winisdDriverCountModel: this.winisdDriverCountModel,
            winisdFlatModel: this.winisdFlatModel,
            lossMode: this.lossMode,
            rgAtDriverSide: this.rgAtDriverSide,
            useTransmissionLinePortModel: this.useTransmissionLinePortModel,
            forceFlatResponse: this.forceFlatResponse,
            filters: this.filters,
            driverAddedMass_kg: this.driverAddedMass_kg,
            vcTempRise_K: this.vcTempRise_K,
            loading: this.loading,
            alfaVC_per_K: this.alfaVC_per_K,
            sweepN: this.sweepN,
            driveVoltage_V: this.driveVoltage_V.value,
            airEnvironment: this.#airOver(root),
            useWinisdAirModel: this.#current().environment.useWinisdAirModel ?? true,
            air: this.#air(root),
            engine: this.#engine,
            ventIssues: this.#issues.vent,
            prIssues: this.#issues.pr,
        };
    }

    /** The sweep this project asks the engine for, as plain data: ready (a `SweepJob`) or
     *  blocked (the issues `sweep()` reports). A job runs the same in a Worker. */
    sweepPlan(P: FrequencyGrid): SweepPlan {
        return sweepPlanOf(this.#sweepSource(), P);
    }

    /** The frequency response, impedance and excursion this design produces — or the issues that
     *  stopped it, each NAMING the quantity the driver does not state. A bare null would say only
     *  "cannot simulate", which is what a caller cannot act on. `value` is null with an empty
     *  `errors` when the active topology is one the engine has no model for, or a field this
     *  project itself needs to sweep (its box volume, its drive voltage) is not yet stated. */
    sweep(P: FrequencyGrid): SweepSolveResult {
        return sweepOf(this.#sweepSource(), P);
    }

    /** The excursion- and power-limited maximum SPL curves. Reports on the same terms as `sweep`,
     *  but does not need a stated drive level: the engine runs these curves at the 2.83 V
     *  reference whatever `eg` it is handed, so that reference is passed here outright. */
    maxCurves(P: FrequencyGrid): MaxCurvesSolveResult {
        return maxCurvesOf(this.#sweepSource(), P);
    }

    /** What is wrong with this project's enclosure parameters — checked BEFORE a sweep, so a
     *  caller can refuse rather than plot nonsense. Empty when nothing is wrong, and also empty
     *  (rather than a false accusation) when the topology cannot be simulated at all. */
    boxParamsIssues(): readonly BoxParamsIssue[] {
        return boxParamsIssuesOf(this.#sweepSource());
    }

    /** The passband level a response is measured against — the reference every dB figure below is
     *  relative to. */
    passbandRef(spl: number[]): number {
        return this.#engine.simulation.passbandRef(spl);
    }

    /** The frequency where the response has fallen `dropDb` below its passband — F3 at 3 dB, F6 at
     *  6, and so on. Null when the response never falls that far inside the swept range. */
    rolloffFreq(sw: SweepResult, dropDb: number): number | null {
        return this.#engine.simulation.rolloffFreq(sw, dropDb);
    }

    /** A non-finite value anywhere in the response, or null. A sweep that produced NaN is a fault
     *  to report, never a curve to draw. */
    classifyFinite(sw: SweepResult): DriverError | null {
        return this.#engine.simulation.classifyFinite(sw);
    }

    /** Finiteness issues split by plotted output, for a caller that renders one chart at a time
     *  and needs one specific cause (BUG_20260906: without this delegate, that caller had no way
     *  to ask the project and reached around it to construct its own `Engine`). */
    classifyFiniteIssues(sw: SweepResult): DriverError[] {
        return this.#engine.simulation.classifyFiniteIssues(sw);
    }

    /** A response clamped flat against a limit, or null — a shape that looks like a valid answer
     *  and is not. */
    classifyFlatClamp(sw: SweepResult): DriverError | null {
        return this.#engine.simulation.classifyFlatClamp(sw);
    }

    /** The same finiteness check for the max-SPL curves. */
    classifyMaxFinite(mx: MaxCurvesResult): DriverError | null {
        return this.#engine.simulation.classifyMaxFinite(mx);
    }

    /**
     * The impedance peak of a swept response — the resonance the design ACTUALLY exhibits, read
     * off the curve rather than predicted from a formula.
     *
     * Reads `Re` off this project's own driver, which is why it lives here and not on the caller.
     * Null when the driver has no usable `Re`, or the curve has no peak.
     */
    impedancePeak(sw: SweepResult | null): { Fsc: number; Qtc: number } | null {
        const Re_ohm = this.driver.specs.Re_ohm.value;
        return Re_ohm === null ? null : this.#engine.driver.findImpedancePeak(sw, Re_ohm);
    }

    /** Start a transient what-if session from the current committed design. */
    beginWhatIf(): void {
        if (this.#whatif) return;
        this.#whatif = structuredClone(this.#committed());
        this.#notify();
    }

    /**
     * An application setting changed under this open project — re-derive and repaint.
     *
     * John, 2026-09-22: "a notification and recall and repaint is required if app level
     * changes". The engine reads its `AppSettings` at call time, so nothing is rebuilt: the
     * recall is `#resolve()` (rewriting the stored marks, such as the vented tuning's
     * plausibility) and the repaint is `#notify()`. Neither touches the DESIGN, so the project
     * does not become edited — changing what you consider plausible is not a change to the box.
     */
    appSettingsChanged(): void {
        this.#resolve();
        this.#notify();
    }

    /** Whether this project currently has a transient what-if layer. */
    isWhatIfActive(): boolean {
        return this.#whatif !== null;
    }

    /** Discard the what-if layer without touching saved or ordinary edited state. The current
     *  layer changes (back to committed) — its 'C' entries are already right, but `#resolve()`
     *  rebuilds `#issues` to match: while the what-if was active every resolve targeted IT, not
     *  the committed layer this reverts to. */
    cancelWhatIf(): void {
        if (!this.#whatif) return;
        this.#whatif = null;
        this.#resolve();
        this.#notify();
    }

    /** Reset the what-if to the committed design while keeping the session open. The current
     *  layer's CONTENT changes (a fresh clone), so `#issues` is rebuilt the same way. */
    resetWhatIf(): void {
        if (!this.#whatif) return;
        this.#whatif = structuredClone(this.#committed());
        this.#resolve();
        this.#notify();
    }

    /** Promote the edited record. A no-op when nothing has been edited. The layer swap itself
     *  changes nothing a resolve would derive differently, but rebuilding `#issues` here keeps
     *  the "always current" invariant simple to trust rather than relying on that observation. */
    save(): void {
        if (!this.#edited) return;
        this.#saved = this.#edited;
        this.#edited = null;
        this.#resolve();
        this.#notify();
    }

    /**
     * Discard every change since the last save, after `confirm` agrees.
     *
     * The challenge is a PARAMETER because the caller — the Cancel button on the project bar —
     * already owns the warning dialog and holds the answer at the moment of the call. Threading a
     * callback through every construction path would deliver a value that one caller already has.
     *
     * Answers whether anything was discarded: false when nothing was edited, and false when the
     * user declined.
     */
    async cancel(confirm: DiscardChallenge): Promise<boolean> {
        if (!this.#edited) return false;
        if (!await confirm()) return false;
        this.#edited = null;
        this.#resolve();
        this.#notify();
        return true;
    }

    // ── vent-group / PR-group solve ───────────────────────────────────────────────────────────
    //
    // FIXME(QO126, bugs/BUG_20260908_six_vent_and_pr_group_solve_methods_are_throwing_stubs.md):
    // these six answer the tuning ↔ paired-quantity relation — vent length on a vented box, added
    // cone mass on a passive-radiator one — which is NOT WIRED. `tuning_goal_hz` is a stored value no
    // calculation consumes, and the forward/inverse methods that would close the loop
    // (`Vent.tuningIn_hz`/`lengthForTuning_m`, `PassiveRadiatorBox.systemTuning_hz`/
    // `addedMassForTuning_kg`) have no callers.
    //
    // Until that relation exists, these report "nothing solved, nothing known" rather than
    // throwing: `notifyVentChanged` runs on EVERY project change (`appState.ts`), so a throw here
    // means no project can be opened at all. Doing nothing is what the app did before the
    // migration, when neither direction had a caller — this is the pre-existing behaviour, not
    // a new one, and the feature is ruled and scoped in QO126.

    /** Manual "Recalc" diagnostic safety net — force-recalculates the whole graph and notifies
     *  subscribers. Every field reads lazily, so the subscriber notification IS the force-solve:
     *  it makes every consumer re-read, which recomputes any derived cell whose sources moved. */
    recalc(): void {
        this.#notify();
    }

    /** @deprecated Use `recalc()` instead. */
    notifyVentChanged(): void {
        this.#notify();
    }

    /** The tuning the vent as built actually produces. A precomputed readout — null, with a
     *  not-available cell, when the box is not vented or the geometry is incomplete. */
    get ventAchievedFb(): Readable<number | null> & Calculated {
        return ventAchievedFbOf(this.#sweepSource());
    }

    /** The highest tuning this vent can reach in this volume (its L=0 ceiling). A precomputed
     *  readout — not-available when the box is not vented or the geometry is incomplete. */
    get ventMaxReachableFb(): Readable<number | null> & Calculated {
        return ventMaxReachableFbOf(this.#sweepSource());
    }

    /** @deprecated Use `recalc()` instead. */
    notifyPrChanged(): void {
        this.#notify();
    }

    /** Batch multiple mutations into a single subscriber notification. */
    batch<T>(fn: () => T): T {
        return this.#listeners.batch(fn);
    }

    /** Register a listener, fired on every change to the current record and on entering or
     *  leaving the edited state. Returns an unsubscribe function. */
    subscribe(fn: () => void): () => void {
        this.#listeners.add(fn);
        return () => {
            this.#listeners.delete(fn);
        };
    }

    #notify(): void {
        this.#listeners.notify();
    }
}
