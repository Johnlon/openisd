import { Engine, LossMode } from '../../engine/index.js';
import type { Air, AirEnvironment, BoxParamsIssue, BoxType, ChartId, DqIssue, DriverError, EnclosureParams, Filter, MaxCurvesResult, MaxCurvesSolveResult, PrIssue, SealedAlignmentIssue, SimulatableBoxType, SweepIssue, SweepParams, SweepResult, SweepSolveResult, VentIssue } from '../../engine/index.js';
import { realAppContext } from '../appContext.js';
import type { AppContext } from '../appContext.js';
import { CalculatedFieldImpl, DefaultingFieldImpl, DualWriteFieldImpl, SetOnlyFieldImpl, absentCell, calculatedCell, defaultingEntryField, enteredCell, focus, inputOf, simpleField, writeEntryDq } from '../cell.js';
import type { Calculatable, Calculated, Clearable, Entered, Readable, SimpleField, Unsolvable, Writable } from '../cell.js';
import { newUuid } from '../newUuid.js';
import { openIsdProjectToWinIsdProject, winIsdProjectToOpenIsdProject } from '../openIsdProjectToWinIsdProject.js';
import { calcVentCount, calculatedEntry, enteredEntry, openISDProjectSessionJsonSchema } from '../openisdSchema.js';
import type { EnvironmentCondition, OpenISDEnvironmentJson, OpenISDProjectJson, OpenISDProjectSessionJson } from '../openisdSchema.js';
import { ProjectBuilder } from '../openisdTransforms.js';
import type { Vent } from '../vent.js';
import type { Box } from '../box/box.js';
import type { FrequencyGrid } from '../box/frequencyGrid.js';
import { isPortCount } from '../box/isPortCount.js';
import { OpenISDBox } from '../box/openISDBox.js';
import { driverSolverParamsOf } from '../driver/driverSolverParamsOf.js';
import { engineCircuitModel } from '../driver/engineCircuitModel.js';
import { OpenISDDriver } from '../driver/openISDDriver.js';
import { OpenISDDriverEmbedded } from '../driver/openISDDriverEmbedded.js';
import type { DiscardChallenge } from './discardChallenge.js';
import type { DragRange } from './dragRange.js';
import type { EnvironmentField, EnvironmentFields } from './environmentFields.js';
import { freshEmbeddedDriver } from './freshEmbeddedDriver.js';
import type { ProjectIssues } from './projectIssues.js';
import { ProjectListeners } from './projectListeners.js';
import { sealedVolumeAsSolverField } from './sealedVolumeAsSolverField.js';

// The domain declares its state here. JSON shapes live in `openisdSchema.ts`.
// Internal JSON types are never re-exported from `domain/index.ts`.
//
// A module-scoped WeakMap bridge (`notifyProject`/`subscribeToProject`) lets
// `ManagedProject` observe internal `OpenISDProject` changes without exposing
// state publicly.

/** WinISD's reference drive: 1 W, and the voltage a sweep runs at before anything is known. */
const DEFAULT_DRIVE_POWER_W = 1;
const DEFAULT_DRIVE_VOLTAGE_V = 1;
/** The lowest drive voltage a project may hold: 10 mV, the smallest the UI's 2 dp shows. */
const MIN_DRIVE_VOLTAGE_V = 0.01;

export class OpenISDProject {
    static builder(driver: OpenISDDriver, engine: Engine, appContext: AppContext = realAppContext): ProjectBuilder {
        return new ProjectBuilder(driver, engine, appContext);
    }

    /**
     * A new project with every section present and nothing stated — what the New Project wizard
     * opens on and writes into, rather than collecting a spec and building at the end.
     *
     * The driver and the radiator are blank devices (`OpenISDDriver.empty()`,
     * `OpenISDPassiveRadiatorStandalone.empty()`), so no physical value here was invented: the
     * wizard repopulates the driver from the one the user picks, and the radiator from the one
     * they pick when they choose a passive-radiator box.
     */
    static empty(engine: Engine, appContext: AppContext = realAppContext): OpenISDProject {
        return OpenISDProject.builder(OpenISDDriver.empty(engine, appContext), engine, appContext)
            .sealed()
            .volume_m3(0)
            .build();
    }

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

    /** The current layer's cached issues — see the class doc comment's "ONE EXCEPTION". */
    #issues: ProjectIssues = { driver: [], signal: [], vent: [], pr: [], sealed: [], ventTuningExtra: null };

    private constructor(saved: OpenISDProjectJson, uuid: string, engine: Engine) {
        this.#saved = saved;
        this.#uuid = uuid;
        this.#engine = engine;
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
        return this.#engine.solveEnvironment(this.#airOver(root)).values;
    }

    /** The four air conditions `root` reads as — each E or C, never absent. */
    #airOver(root: SimpleField<OpenISDProjectJson>): AirEnvironment {
        const env = this.#envFieldsOver(focus(root, 'environment'));
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

    /** What the user calls this project. A LABEL, not an identity — two projects may share one,
     *  which is exactly why `uuid()` exists. */
    get name(): SimpleField<string> {
        return focus(this.#slot('meta'), 'name');
    }

    /** WinISD Project tab: who made this project, and when. */
    get creator(): SimpleField<string> {
        return focus(this.#slot('meta'), 'creator');
    }

    get created(): SimpleField<string> {
        return focus(this.#slot('meta'), 'created');
    }

    get modified(): SimpleField<string> {
        return focus(this.#slot('meta'), 'modified');
    }

    /** WinISD Project tab: the user's own note about this project. Stored, never interpreted. */
    get description(): Readable<string> & Entered & Writable<string> {
        const lens = this.#slot('meta');
        return new SetOnlyFieldImpl<string>(
            () => enteredCell('description', lens.value.description),
            {
                entered: (v: string) => lens.set({...lens.value, description: v}),
            },
        );
    }

    /** The signal-chain filter list. */
    get filters(): SimpleField<readonly Filter[]> {
        return focus(this.#slot('filters'), 'filters');
    }

    /** Force-flat auto-EQ — WinISD Advanced "Force flat response". */
    get forceFlatResponse(): SimpleField<boolean> {
        return focus(this.#slot('advanced'), 'forceFlatResponse');
    }

    /** Model ports as a lossy transmission line instead of a lumped mass — WinISD Advanced
     *  "Use transmission line-model for port simulation". */
    get useTransmissionLinePortModel(): SimpleField<boolean> {
        return focus(this.#slot('advanced'), 'useTransmissionLinePortModel');
    }

    /** WinISD Advanced "Rg is at driver side" — whether the amplifier's source resistance
     *  (`Rs_ohm`) is applied per driver or once across the whole array. */
    get rgAtDriverSide(): SimpleField<boolean> {
        return focus(this.#slot('advanced'), 'rgAtDriverSide');
    }

    /** WinISD Advanced "Simulate voice coil inductance" — includes Le in the acoustic circuit
     *  model (gyrator) rather than just the impedance plot (winisd). 'winisdGyrator' is WinISD's
     *  own inductance-on model. */
    get circuitModel(): SimpleField<'winisd' | 'gyrator' | 'winisdGyrator'> {
        return focus(this.#slot('advanced'), 'circuitModel');
    }

    /** WinISD Advanced "SPL graph is Xmax limited" — whether the SPL chart shows the
     *  Xmax-backed-off curve instead of the unclamped one. Display only. */
    get splGraphIsXmaxLimited(): SimpleField<boolean> {
        return focus(this.#slot('advanced'), 'splGraphIsXmaxLimited');
    }

    /** Sealed-box resonance loss model (S10/QO130) — which physics model `box.sealed`'s Fsc/Qtc
     *  readout uses. PROJECT-scoped, not a UI singleton: two open projects must not share one
     *  loss mode. `advanced.lossMode` stores the wire string; this is the one boundary that
     *  translates it via `LossMode.parse`/`.value`, matching the `circuitModel` accessor above. */
    get lossMode(): SimpleField<LossMode> {
        const lens = focus(this.#slot('advanced'), 'lossMode');
        return {
            get value() { return LossMode.parse(lens.value); },
            set: (mode: LossMode) => lens.set(mode.value),
        };
    }

    /** WinISD Advanced / Compatibility "Use WinISD driver calculations" — whether engine sweeps
     *  substitute the driver WinISD's own simulation acts on, `Mms = 1/((2π·Fs)²·Cms)`,
     *  `Rms = 2π·Fs·Mms/Qms` and `BL = √(Re/(2π·Fs·Qes·Cms))`, for entered values that conflict
     *  with them (measured 2026-09-26, docs/research/WINISD_PARITY.md). On where a project does
     *  not say, per the README: untouched, OpenISD gives WinISD's answer. */
    get winisdDriverModel(): SimpleField<boolean> {
        const lens = focus(this.#slot('advanced'), 'winisdDriverModel');
        return {
            get value() { return lens.value ?? true; },
            set: (on: boolean) => lens.set(on),
        };
    }

    /** WinISD Compatibility "WinISD VA model": the amplifier apparent load power chart as WinISD
     *  computes it, P·Re·|Hf|²/|Z + Rg| (BUG_20260927_winisd-va-uses-re-not-re-plus-rg). Off: the
     *  apparent power the amplifier delivers, P·(Re + Rg)·|Hf|²/|Z_amp|. On where a project does
     *  not say. */
    get winisdVaModel(): SimpleField<boolean> {
        const lens = focus(this.#slot('advanced'), 'winisdVaModel');
        return {
            get value() { return lens.value ?? true; },
            set: (on: boolean) => lens.set(on),
        };
    }

    /** Sets every WinISD-vs-conventional compat switch to WinISD. Native WinISD controls (voice
     *  coil inductance on/off, "Rg is at driver side") and project data keep their values. */
    applyWinisdSettings(): void {
        this.lossMode.set(LossMode.parse('winisd-lossy'));
        this.envUseWinisdAirModel.set(true);
        this.winisdDriverModel.set(true);
        this.winisdVaModel.set(true);
    }

    /** Which charts are open (S10/QO130) — PROJECT-scoped, reversing QO90 for this field.
     *  Empty when absent (a project saved before S10, or a fresh one). Plain strings, not
     *  `ChartId`: this is PERSISTED project data (`.owpr`), so it must stay readable across a
     *  version skew that adds/removes chart ids — `parseChartId` (packages/ui `logic/series.ts`)
     *  does the string↔member conversion at the UI boundary. */
    get graphs(): SimpleField<readonly string[]> {
        const lens = focus(this.#slot('charts'), 'graphs');
        return {
            get value() { return lens.value ?? []; },
            set: (ids) => lens.set([...ids]),
        };
    }

    /** Which charts this project's box type shows, in WinISD's own chart-menu order — a design
     *  decision, not a UI one (bugs/BUG_20260927_winisd-charts-missing.md): port charts only
     *  for a ported box, PR charts only for a radiator, the ten system charts and the three
     *  EQ/filter charts always. The UI shows exactly the ids this returns, never a second list
     *  of "which charts apply". */
    get charts(): readonly ChartId[] {
        return this.#engine.chartsFor(this.box.boxType.value);
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
        const charts = this.#slot('charts');
        return {
            get value() { return charts.value.traceColor ?? null; },
            set: (v) => charts.set({...charts.value, traceColor: v ?? undefined}),
        };
    }

    get sweepN(): SimpleField<number | null> {
        const charts = this.#slot('charts');
        return {
            get value() { return charts.value.N ?? null; },
            set: (v) => charts.set({...charts.value, N: v ?? undefined}),
        };
    }

    /** A record ENTERS the process here. A record carries no identity, so one is minted — two
     *  wraps of one record are two independently editable projects, which is what opening a FILE
     *  twice should give. */
    static wrap(json: OpenISDProjectJson, engine: Engine, appContext: AppContext = realAppContext): OpenISDProject {
        return this.wrapWithIdentity(freshEmbeddedDriver(json, appContext), appContext.newId(), engine);
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
    static wrapWithIdentity(json: OpenISDProjectJson, uuid: string, engine: Engine): OpenISDProject {
        return new OpenISDProject(json, uuid, engine);
    }

    /** Wrap a stored session (saved and edited states) under an adopted identity. */
    static wrapSession(session: OpenISDProjectSessionJson, uuid: string, engine: Engine, appContext: AppContext = realAppContext): OpenISDProject {
        const project = new OpenISDProject(freshEmbeddedDriver(session.saved, appContext), uuid, engine);
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
            else this.#edited = {...base, [key]: value};
            this.#resolve();
            this.#notify();
        });
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
            else { this.#ensureEditing(); this.#edited = json; }
            this.#resolve();
            this.#notify();
        });
    }

    /**
     * T11/S2-7d: resolve the CURRENT layer's driver — write every quantity `solveDriver` can
     * derive back into THAT layer as a `'C'` entry, and cache the result in `#issues`.
     *
     * Reads and writes go DIRECTLY to the layer object below, never through `#slot`/`#root`:
     * those always promote to `#edited` and notify, which would make simply LOADING a project
     * (`wrap()`) register as "modified", and would make a solve's OWN writes notify a SECOND
     * time for one user action — the exact write-on-read/write-on-solve loop that broke
     * `OpenISDDriverEmbedded` in S2-7c before its own auto-resolve was pulled out of the shared
     * driver constructor (see that class's own note).
     */
    #resolve(): void {
        const directRoot = simpleField<OpenISDProjectJson>(
            () => this.#whatif ?? this.#edited ?? this.#saved,
            (json) => {
                if (this.#whatif) this.#whatif = json;
                else if (this.#edited) this.#edited = json;
                else this.#saved = json;
            });
        // Before the driver: its own air falls back to these three conditions, so they must
        // state the app's default by the time `driver.resolve()` reads them.
        this.#resolveEnvironment(focus(directRoot, 'environment'));
        const driver = this.#driverOver(directRoot);
        const driverIssues = driver.resolve();

        // The drive power/voltage pair, against the driver's just-resolved Re. Its dq is read
        // from `#issues.signal` at read time, so no `projectGroupDq` here.
        const Re_ohm = this.#usableReOver(directRoot);
        this.#settleSignal(focus(directRoot, 'signal'), Re_ohm);
        const signal = this.#engine.solveSignal({
            power_W: this.#powerDriveOver(directRoot),
            Re_ohm: inputOf(() => Re_ohm),
            voltage_V: this.#driveVoltageOver(directRoot),
            Rs_ohm: inputOf(() => this.Rs_ohm.value),
        });

        // The project's own air — the driver's OWN c_m_per_s/roo_kg_per_m3 are display-only and
        // feed nothing (BUG_20260924_driver-solve-and-sweep-use-different-air-models.md).
        const air: Air = this.#air(directRoot);

        const box = this.#boxOver(directRoot);
        // GEOMETRY IS IN, ACOUSTICS IS OUT (John, 2026-08-26): every port's area ↔ dims
        // relation solves here, unconditionally, for all 7 vents regardless of which box
        // type is active — geometry does not depend on that. Must run BEFORE the acoustic
        // `solveVent` calls below, which read `area_m2` as a plain input.
        const vents: readonly Vent[] = [
            box.vented.vent, box.bandpass4.vents.front,
            box.bandpass6.vents.rear, box.bandpass6.vents.front,
            box.abc.vents.rear, box.abc.vents.front, box.abc.vents.intra,
        ];
        for (const v of vents) {
            this.#resolveVentGeometry(v);
            this.#resolveVentCount(v);
        }
        const boxType = directRoot.value.box.boxType;
        let vent: readonly VentIssue[] = [];
        let pr: readonly PrIssue[] = [];
        let sealed: readonly SealedAlignmentIssue[] = [];
        let ventTuningExtra: DqIssue | null = null;

        if (boxType === 'vented') {
            vent = this.#engine.solveVent({
                tuning_goal_hz: box.vented.tuning_goal_hz,
                length_m: box.vented.vent.length_m,
                Vb_m3: inputOf(() => box.vented.volume_m3.value),
                area_m2: inputOf(() => box.vented.vent.area_m2.value),
                count: inputOf(() => box.vented.vent.count.value),
                endCorrection_m: inputOf(() => box.vented.vent.endCorrection_m.value),
            }, air);
            // The designed tuning is WinISD's own answer and is not changed — it is marked.
            // Read live off `#issues.ventTuningExtra`, appended to `#issues.vent`'s own mark,
            // never over it: the two say different things (this geometry does not solve /
            // nobody would build this).
            const Fb = box.vented.tuning_goal_hz.value;
            ventTuningExtra = Fb === null ? null : this.#engine.ventedTuningIssue(Fb);
        } else if (boxType === 'bandpass4') {
            vent = this.#engine.solveVent({
                tuning_goal_hz: box.bandpass4.chambers.front.tuning_goal_hz,
                length_m: box.bandpass4.vents.front.length_m,
                Vb_m3: inputOf(() => box.bandpass4.chambers.front.volume_m3.value),
                area_m2: inputOf(() => box.bandpass4.vents.front.area_m2.value),
                count: inputOf(() => box.bandpass4.vents.front.count.value),
                endCorrection_m: inputOf(() => box.bandpass4.vents.front.endCorrection_m.value),
            }, air);
        } else if (boxType === 'box-passive-radiator') {
            const p = box.passiveRadiator;
            const r = p.radiator;
            pr = this.#engine.solvePr({
                addedMass_kg: p.addedMass_kg,
                tuning_goal_hz: p.tuning_goal_hz,
                resonanceWithAddedMass_hz: p.resonanceWithAddedMass_hz,
                systemTuning_hz: p.systemTuning_hz,
                Vb_m3: inputOf(() => p.volume_m3.value || box.vented.volume_m3.value),
                prMmd_kg: inputOf(() => r.spec.Mms_kg.value),
                prSd_m2: inputOf(() => r.spec.Sd_m2.value),
                prCms_m_per_N: inputOf(() => r.spec.Cms_m_per_N.value),
            }, air);
        } else if (boxType === 'sealed') {
            const ts = driver.specs;
            // The Rg-loaded Qts, inlined rather than `sourceLoadedQts(Rs)` (that method reads
            // the NOTIFYING `this.driver.ts` — calling it from inside a resolve would re-enter
            // the write-on-read loop `#resolve()`'s own doc comment warns against). Mirrors
            // `#sealedResonance_hz`'s pre-S10 feed exactly (golden Fsc 63.1762 Hz/Qtc 0.5995).
            const rgLoadedQts = (): number | null => {
                const Qts = ts.Qts.value;
                if (Qts === null) return null;
                return this.#engine.sourceLoadedQts(
                    ts.Qms.value ?? NaN, ts.Qes.value ?? NaN, ts.Re_ohm.value ?? NaN,
                    directRoot.value.driverEmbedding.Rs_ohm, Qts);
            };
            sealed = this.#engine.solveSealedAlignment({
                Qts: inputOf(rgLoadedQts),
                Vas_m3: inputOf(() => ts.Vas_m3.value),
                Fs_hz: inputOf(() => ts.Fs_hz.value),
                Ql: inputOf(() => box.sealed.losses.Ql.value),
                Qa: inputOf(() => box.sealed.losses.Qa.value),
                lossMode: inputOf(() => directRoot.value.advanced.lossMode ?? null),
                Qtc: box.sealed.q_tc,
                Vb_m3: sealedVolumeAsSolverField(box.sealed.volume_m3),
            });
        }

        this.#issues = { driver: driverIssues, signal, vent, pr, sealed, ventTuningExtra };
    }

    /** Solves `vent.area_m2` against whichever dimension its own `shape` uses: `diameter_m`
     *  round, `height_m` (times the live `width_m`) slotted. PLAIN GEOMETRY — πr² and width ×
     *  height involve no air, compliance, resonance or end correction, so this belongs in the
     *  domain, not the engine (John 2026-08-26: "simple geometric calc like pi r squared are ok
     *  in the domain").
     *
     *  Entering either side of a pair already atomically clears the other (`pairedField`'s own
     *  `commitPair`), so this only ever has one side entered, or neither. `setNotAvailable()` on
     *  the "neither" branch wipes a stale calculated echo left over from a shape the vent has
     *  since switched away from — a plain `shape.set()` does not itself touch `area_m2`. */
    #resolveVentGeometry(vent: Vent): void {
        if (vent.shape.value === 'round') {
            if (vent.diameter_m.entered) {
                vent.area_m2.setCalculated(Math.PI * (vent.diameter_m.value! / 2) ** 2);
            } else if (vent.area_m2.entered) {
                vent.diameter_m.setCalculated(2 * Math.sqrt(vent.area_m2.value! / Math.PI));
            } else {
                vent.area_m2.setNotAvailable();
                vent.diameter_m.setNotAvailable();
            }
            return;
        }
        const width = vent.width_m.value;
        if (vent.height_m.entered) {
            if (width === null) vent.area_m2.setNotAvailable();
            else vent.area_m2.setCalculated(width * vent.height_m.value!);
        } else if (vent.area_m2.entered) {
            if (width === null || width === 0) vent.height_m.setNotAvailable();
            else vent.height_m.setCalculated(vent.area_m2.value! / width);
        } else {
            vent.area_m2.setNotAvailable();
            vent.height_m.setNotAvailable();
        }
    }

    /** Stores the port count's default (one port) as a 'C' entry wherever the record states no
     *  count, or states one that is not a whole number of at least one — the repair John ruled on
     *  2026-09-20, written into the record rather than applied at read time (John, 2026-09-24:
     *  "simply no reason for these exceptions to the rule"). No solve derives a port count, so
     *  this is the only write that ever makes one calculated. */
    #resolveVentCount(vent: Vent): void {
        const v = vent.count.value;
        if (!isPortCount(v)) vent.count.setCalculated(calcVentCount());
        else if (!vent.count.entered) vent.count.setCalculated(v);
    }

    /** Stores the app's Options → Environment value as a 'C' entry for every condition the
     *  project does not state itself: clear, then store what the empty slot reads. Re-stamped on
     *  every resolve, so changing Options reaches an unstated project (`appSettingsChanged`); an
     *  entered condition is never touched. */
    #resolveEnvironment(environment: SimpleField<OpenISDEnvironmentJson>): void {
        const env = this.#envFieldsOver(environment);
        for (const condition of [env.tempK, env.humidityPct, env.pressurePa]) {
            if (condition.entered) continue;
            condition.clear();
            condition.setCalculated(condition.value);
        }
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

    /** This project as WinISD `.wpr` text — the form `OpenISDProject.fromWprText` reads back.
     *
     *  Writing is a SNAPSHOT: the converter reads this project and renders text, and keeps no
     *  hold on it afterwards, so saving a file never changes what is on screen.
     *
     *  `.wpr` models fewer box types and fewer fields than openisd does, so this is a lossy
     *  write and `value` is null when the box cannot be expressed at all (a `bandpass6`, say).
     *  `errors` carries the reason and every field dropped along the way. */
    toWprText(engine: Engine): { value: string | null; errors: DriverError[] } {
        const committed = OpenISDProject.wrapWithIdentity(structuredClone(this.#committed()), this.#uuid, this.#engine);
        const {value: wpr, errors} = openIsdProjectToWinIsdProject(committed, engine);
        return {value: wpr ? wpr.toWpr() : null, errors};
    }

    /** WinISD `.wpr` text back to a project. The inverse of `toWprText()`, as far as a format
     *  carrying fewer box types and fields allows. */
    static fromWprText(text: string, engine: Engine): { value: OpenISDProject | null; errors: DriverError[] } {
        return winIsdProjectToOpenIsdProject(text, engine);
    }

    /** This project as `.owpr` text — openisd project JSON, the form
     *  `OpenISDProject.fromOwprText` reads back. Carries the saved state, the edited state and
     *  the name, so reopening the file restores unsaved edits exactly as they were.
     *
     *  Lossless, unlike `toWprText()`: this is openisd's own format, so there is nothing to drop
     *  and no error to report. */
    toOwprText(): string {
        return JSON.stringify(this.cloneSession(), null, 2);
    }

    /** `.owpr` text back to a project, or everything wrong with the text. The inverse of
     *  `toOwprText()`.
     *
     *  The project takes a FRESH identity: a file's contents are provenance, not a store key
     *  (QO81), so opening the same file twice yields two independently addressable projects. */
    static fromOwprText(text: string, engine: Engine): OpenISDProject | string[] {
        let parsed: unknown;
        try {
            parsed = JSON.parse(text);
        } catch {
            return ['not valid JSON'];
        }
        const result = openISDProjectSessionJsonSchema.safeParse(parsed);
        if (!result.success) {
            return result.error.issues.map(issue => issue.path.length === 0
                ? issue.message
                : `'${issue.path.join('.')}': ${issue.message}`);
        }
        return OpenISDProject.wrapSession(result.data, newUuid(), engine);
    }

    /** Serialises saved and ordinary edited states for persistence. The transient what-if is absent. */
    cloneSession(): OpenISDProjectSessionJson {
        return {
            label: this.#committed().meta.name,
            saved: structuredClone(this.#saved),
            edited: this.#edited ? structuredClone(this.#edited) : null,
        };
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

    /** The drive power — WinISD's Signal-tab "Input Power". While the driver has a usable Re,
     *  `power_W = voltage_V² / Re` holds and whichever of the pair was entered last is entered;
     *  the other is calculated. Without a usable Re it is not available and cannot be entered —
     *  its dq names the missing Re. */
    get powerDrive_W(): Readable<number | null> & Entered & Calculated & Writable<number> & Clearable & Calculatable<number> & Unsolvable {
        return this.#powerDriveOver(this.#root());
    }

    /** `powerDrive_W` over `root` — `#resolve()` writes it through its direct root. */
    #powerDriveOver(root: SimpleField<OpenISDProjectJson>): DualWriteFieldImpl<number> {
        const signal = focus(root, 'signal');
        return new DualWriteFieldImpl<number>(
            () => {
                const entry = signal.value.power_W;
                if (entry === undefined) return absentCell<number>('power_W', this.#issues.signal);
                return entry.state === 'E'
                    ? enteredCell<number | null>('power_W', entry.value)
                    : calculatedCell<number | null>('power_W', entry.value);
            },
            {
                entered: (v: number) => {
                    const Re_ohm = this.#usableReOver(root);
                    if (Re_ohm === null) {
                        throw new Error('powerDrive_W cannot be entered: the driver has no usable Re_ohm yet.');
                    }
                    const Rs_ohm = this.Rs_ohm.value ?? 0;
                    if (!(v > 0 && this.#engine.driveVoltage(v, Re_ohm, Rs_ohm) >= MIN_DRIVE_VOLTAGE_V)) {
                        throw new RangeError(`powerDrive_W ${v} W drives below the 10 mV minimum voltage.`);
                    }
                    signal.set({...signal.value, power_W: enteredEntry(v), voltage_V: undefined});
                },
                // With Re known, the voltage stays as it reads and becomes the entered one.
                clear: () => {
                    const {voltage_V} = signal.value;
                    const keepVoltage = this.#usableReOver(root) !== null && voltage_V !== undefined;
                    signal.set({...signal.value, power_W: undefined, voltage_V: keepVoltage ? enteredEntry(voltage_V.value) : voltage_V});
                },
                calculated: (v: number) => signal.set({...signal.value, power_W: calculatedEntry(v)}),
                dq: (list) => writeEntryDq(focus(signal, 'power_W'), list, this.#engine),
            },
        );
    }

    /**
     * The drive voltage — the `eg` every sweep runs at. Never absent: an empty slot reads
     * `DEFAULT_DRIVE_VOLTAGE_V` as calculated, and it is never below 10 mV. Entering it needs no Re.
     * `.clear()` empties the
     * pair; the resolve then fills it back from its defaults.
     */
    get driveVoltage_V(): Readable<number> & Entered & Calculated & Writable<number> & Clearable & Calculatable<number> {
        return this.#driveVoltageOver(this.#root());
    }

    /** `driveVoltage_V` over `root` — `#resolve()` writes it through its direct root. */
    #driveVoltageOver(root: SimpleField<OpenISDProjectJson>): DefaultingFieldImpl<number> {
        const signal = focus(root, 'signal');
        return new DefaultingFieldImpl<number>(
            () => {
                const entry = signal.value.voltage_V;
                if (entry === undefined) return calculatedCell('voltage_V', DEFAULT_DRIVE_VOLTAGE_V);
                return entry.state === 'E'
                    ? enteredCell('voltage_V', entry.value)
                    : calculatedCell('voltage_V', entry.value);
            },
            {
                entered: (v: number) => {
                    if (!(v >= MIN_DRIVE_VOLTAGE_V)) throw new RangeError(`driveVoltage_V ${v} V is below the 10 mV minimum.`);
                    signal.set({...signal.value, voltage_V: enteredEntry(v), power_W: undefined});
                },
                clear: () => signal.set({...signal.value, voltage_V: undefined, power_W: undefined}),
                calculated: (v: number) => signal.set({...signal.value, voltage_V: calculatedEntry(v)}),
                dq: (list) => writeEntryDq(focus(signal, 'voltage_V'), list, this.#engine),
            },
        );
    }

    /** The driver's Re when it is a positive finite number, else null. */
    #usableReOver(root: SimpleField<OpenISDProjectJson>): number | null {
        const Re_ohm = this.#driverOver(root).specs.Re_ohm.value;
        return Re_ohm !== null && Number.isFinite(Re_ohm) && Re_ohm > 0 ? Re_ohm : null;
    }

    /**
     * The signal pair's entered-value rules the solve does not make. Re lost (a power is still
     * stored, which only a known Re allows): the voltage keeps its value as entered and the power
     * goes. Re known with nothing entered: the power is the 1 W reference, entered.
     */
    #settleSignal(signal: SimpleField<OpenISDProjectJson['signal']>, Re_ohm: number | null): void {
        const {power_W, voltage_V} = signal.value;
        if (Re_ohm === null) {
            if (power_W !== undefined) {
                signal.set({...signal.value, power_W: undefined, voltage_V: voltage_V && enteredEntry(voltage_V.value)});
            }
            return;
        }
        if (power_W?.state !== 'E' && voltage_V?.state !== 'E') {
            signal.set({...signal.value, power_W: enteredEntry(DEFAULT_DRIVE_POWER_W)});
        }
    }

    // ── ENVIRONMENT ───────────────────────────────────────────────────────────────────────────

    /** This project's air temperature, WinISD Advanced "Temperature". E when typed, else C: the
     *  app's Options → Environment value (`Engine.envDefaults()`), which the resolve also stores. */
    get envTempK(): Readable<number> & Entered & Calculated & Writable<number> & Clearable & Calculatable<number> {
        return this.#envFieldsOver(this.#slot('environment')).tempK;
    }

    /** @deprecated Use `project.envTempK.set(tempK)` instead. */
    setEnvTempK(tempK: number): void {
        this.envTempK.set(tempK);
    }

    /** This project's relative humidity, WinISD Advanced "Humidity". Stored the same way as
     *  `envTempK`. */
    get envHumidityPct(): Readable<number> & Entered & Calculated & Writable<number> & Clearable & Calculatable<number> {
        return this.#envFieldsOver(this.#slot('environment')).humidityPct;
    }

    /** @deprecated Use `project.envHumidityPct.set(humidityPct)` instead. */
    setEnvHumidityPct(humidityPct: number): void {
        this.envHumidityPct.set(humidityPct);
    }

    /** This project's atmospheric pressure, WinISD Advanced "Pressure". Stored the same way as
     *  `envTempK`. */
    get envPressurePa(): Readable<number> & Entered & Calculated & Writable<number> & Clearable & Calculatable<number> {
        return this.#envFieldsOver(this.#slot('environment')).pressurePa;
    }

    /** The three environment conditions over the environment given, each reading the app's
     *  Options → Environment value as C when not entered. The getters above pass the notifying
     *  `#slot('environment')`; `#resolve()` passes a DIRECT environment of its own, the same split
     *  `#driverOver`/`#boxOver` have. */
    #envFieldsOver(environment: SimpleField<OpenISDEnvironmentJson>): EnvironmentFields {
        const field = (key: EnvironmentCondition, fallback: () => number): EnvironmentField =>
            defaultingEntryField(focus(environment, key), key, this.#engine, fallback);
        return {
            tempK: field('temperature_K', () => this.#engine.envDefaults().tempK),
            humidityPct: field('humidity_pct', () => this.#engine.envDefaults().humidityPct),
            pressurePa: field('pressure_Pa', () => this.#engine.envDefaults().pressurePa),
        };
    }

    /** @deprecated Use `project.envPressurePa.set(pressurePa)` instead. */
    setEnvPressurePa(pressurePa: number): void {
        this.envPressurePa.set(pressurePa);
    }

    /** Which air formula this project's sweeps use — WinISD's parity model when true, OpenISD's
     *  physical CIPM-2007 model when false. Null reads as true (QO95): a new project matches
     *  WinISD out of the box. See `engine/air.ts` for the two models. */
    get envUseWinisdAirModel(): SimpleField<boolean> {
        const slot = this.#slot('environment');
        return {
            get value() { return slot.value.useWinisdAirModel ?? true; },
            set: (useWinisdAirModel: boolean) => {
                slot.set({ ...slot.value, useWinisdAirModel });
            },
        };
    }

    /** @deprecated Use `project.envUseWinisdAirModel.set(useWinisdAirModel)` instead. */
    setEnvUseWinisdAirModel(useWinisdAirModel: boolean): void {
        this.envUseWinisdAirModel.set(useWinisdAirModel);
    }

    /**
     * Qts as the amplifier's source impedance actually loads it.
     *
     * `Rs` is a PARAMETER rather than a record field because the record has no home for it — the
     * same decision `packages/model`'s `sealedResonance()` made and for the same reason. When the
     * amplifier's output impedance gets a home, this reads it instead.
     *
     * Null when the driver's Q group is too incomplete to resolve.
     */
    sourceLoadedQts(Rs: number): number | null {
        const ts = this.driver.specs;
        const Qms = ts.Qms.value, Qes = ts.Qes.value, Re_ohm = ts.Re_ohm.value, Qts = ts.Qts.value;
        if (Qms === null || Qes === null || Re_ohm === null || Qts === null) return null;
        return this.#engine.sourceLoadedQts(Qms, Qes, Re_ohm, Rs, Qts);
    }

    // ── SIMULATION — the engine's sweep, run on THIS project's driver and box ──────────────────
    //
    // Everything the engine's `SweepParams` needs beyond the frequency grid is already stored
    // somewhere on this project's own record — the box's volume/vent/losses/PR-chamber fields,
    // the driver embedding's wiring/count/thermal fields, the Advanced-tab settings. A caller
    // asking for a sweep supplies only what it actually decides: the grid to sweep over. Passing
    // any of the rest back in would let a caller override a fact the project already states about
    // itself, which is the thing John's 2026-09-06 ruling rules out.

    /** The frequency grid a sweep runs over — the only thing about a sweep this project does not
     *  already know about itself. */
    /** The ENCLOSURE parameters alone — what `solveBoxParams` reads (`engine/params.ts`: `Vb`,
     *  `Vf`, `Sp`, `prSd`, `prCms`, `prMmd`), with no drive level and no sweep settings.
     *
     *  Separate from `#sweepParams` because the two answer different questions. Sweeping needs a
     *  drive voltage, which needs the driver's `Re`; checking that a box volume is a usable number
     *  does not. Building the validation input through the sweep's guard made an absent `Re`
     *  silence every enclosure complaint on exactly the half-finished projects that most need
     *  them. A zero drive is used only when the circuit must report its missing driver inputs;
     *  it is never returned as a simulation result.
     *
     *  An unstated volume is passed through as-is rather than short-circuiting to "no issues":
     *  "you have not sized the box" is the complaint, not a reason to stay quiet. */
    #enclosureParams(boxType: SimulatableBoxType): EnclosureParams {
        const {Vf, Sp, prSd, prCms, prMmd} = this.#boxSpecificParams(boxType);
        return {Vb: this.#boxVolume_m3(boxType), Vf, Sp, prSd, prCms, prMmd};
    }

    /** `eg` is the drive voltage the sweep runs at: `sweep()` passes the solved `driveVoltage_V`
     *  (gated non-null first), `maxCurves()` the 2.83 V reference the engine runs those curves at. */
    #sweepParams(P: FrequencyGrid, eg: number, boxType: SimulatableBoxType): SweepParams {
        const Vb = this.#boxVolume_m3(boxType);
        const box = this.box;
        let losses: {Ql?: number; Qa?: number; Qp?: number} = {};
        switch (boxType) {
            case 'sealed': losses = {Ql: box.sealed.losses.Ql.value, Qa: box.sealed.losses.Qa.value}; break;
            case 'vented': losses = {Ql: box.vented.losses.Ql.value, Qa: box.vented.losses.Qa.value, Qp: box.vented.losses.Qp.value}; break;
            case 'bandpass4': losses = {Ql: box.bandpass4.chambers.rear.losses.Ql.value, Qa: box.bandpass4.chambers.rear.losses.Qa.value}; break;
            case 'box-passive-radiator': losses = {Ql: box.passiveRadiator.losses.Ql.value, Qa: box.passiveRadiator.losses.Qa.value}; break;
        }

        return {
             Vb, eg,
            fmin: P.fmin,
            fmax: P.fmax,
            N: P.N ?? this.sweepN.value ?? undefined,
            nDrivers: this.nDrivers.value,
            wiring: this.wiring.value,
            Rs: this.Rs_ohm.value,
            circuitModel: engineCircuitModel(this.circuitModel.value, this.winisdDriverModel.value),
            winisdVaModel: this.winisdVaModel.value,
            lossMode: this.lossMode.value.value,
            Ql: losses.Ql, Qa: losses.Qa, Qp: losses.Qp,
            ...this.#boxSpecificParams(boxType),
            ...this.#airOver(this.#root()),
            useWinisdAirModel: this.#current().environment.useWinisdAirModel ?? true,
            driverAddedMass: this.driverAddedMass_kg.value,
            vcTempRise: this.vcTempRise_K.value,
            alfaVC: this.alfaVC_per_K.value,
            rgAtDriverSide: this.rgAtDriverSide.value,
            tlPortModel: this.useTransmissionLinePortModel.value,
            forceFlatResponse: this.forceFlatResponse.value,
            filters: [...this.filters.value],
        };
    }

    /** This project's box volume, WHICHEVER topology is active — `Vb` in `SweepParams` is always
     *  the driver-side chamber's own volume, sealed or the equivalent for every other topology. */
    #boxVolume_m3(boxType: SimulatableBoxType): number {
        const box = this.box;
        switch (boxType) {
            case 'sealed': return box.sealed.volume_m3.value;
            case 'vented': return box.vented.volume_m3.value;
            case 'bandpass4': return box.bandpass4.chambers.rear.volume_m3.value;
            case 'box-passive-radiator': return box.passiveRadiator.volume_m3.value;
        }
    }

    /** The fields only one box topology reads — the vent's `Sp`/`Leff` for `vented`/`bandpass4`,
     *  the passive radiator's five for `box-passive-radiator`. Geometry only (`area_m2()`,
     *  `effectiveLength_m()`), never acoustics, per this file's header ruling. */
    #boxSpecificParams(boxType: BoxType): Partial<SweepParams> {
        const box = this.box;
        switch (boxType) {
            case 'vented': {
                const Sp = box.vented.vent.totalArea_m2();
                const Leff = box.vented.vent.effectiveLength_m();
                // Fb for circuit.ts's winisd-lossy port mass (Map = 1/(ωb²·Cab), never from
                // Leff). Null only when the vent's tuning ↔ length pair is itself unsolved,
                // which #ventSweepIssues already refuses the sweep over before this is read.
                const Fb = box.vented.tuning_goal_hz.value;
                return {Sp: Sp ?? undefined, Leff: Leff ?? undefined, Fb: Fb ?? undefined};
            }
            case 'bandpass4': {
                const Sp = box.bandpass4.vents.front.totalArea_m2();
                const Leff = box.bandpass4.vents.front.effectiveLength_m();
                const rear = box.bandpass4.chambers.rear.losses;
                const front = box.bandpass4.chambers.front;
                // circuit.ts's bandpass4 `winisd-lossy` branch reads each chamber's OWN losses
                // and the front's own tuning — never the shared Ql/Qa/Qp above (engine/types.ts
                // `SweepParams.Qlr` doc, bugs/BUG_20260927_bandpass4-box-not-winisd-form.md).
                return {
                    Vf: front.volume_m3.value, Sp: Sp ?? undefined, Leff: Leff ?? undefined,
                    Qlr: rear.Ql.value, Qar: rear.Qa.value, Qiclfr: rear.Qicl.value,
                    Qlf: front.losses.Ql.value, Qaf: front.losses.Qa.value, Qpf: front.losses.Qp.value,
                    Ff: front.tuning_goal_hz.value ?? undefined,
                };
            }
            case 'box-passive-radiator': {
                const r = box.passiveRadiator.radiator.spec;
                // Fr for circuit.ts's winisd-lossy Ral/Raa (fixed at the box's own tuning, never
                // per-frequency). Null only when the volume/radiator/tuning-pair is itself
                // unsolved, which #prSweepIssues already refuses the sweep over before this is
                // read.
                const Fr = box.passiveRadiator.systemTuning_hz.value;
                return {
                    prSd: r.Sd_m2.value ?? undefined,
                    prNum: box.passiveRadiator.count.value,
                    prMmd: r.Mms_kg.value ?? undefined,
                    prMadd: box.passiveRadiator.addedMass_kg.value ?? undefined,
                    prCms: r.Cms_m_per_N.value ?? undefined,
                    prRms: r.Rms_kg_per_s.value ?? undefined,
                    Fr: Fr ?? undefined,
                };
            }
            default: return {};
        }
    }

    /**
     * Which of the engine's simulable topologies this project is, or null.
     *
     * There is ONE box-type vocabulary now, so this translates nothing — it asks the engine which
     * of its own types it can model. Null for `bandpass6` and `abc`, which it has no circuit for,
     * and that null is the reason every simulation method below can return null: not a failure, a
     * topology the engine does not yet cover.
     */
    #engineBoxType(): SimulatableBoxType | null {
        return this.#engine.simulatableBoxType(this.box.boxType.value);
    }

    /** The frequency response, impedance and excursion this design produces — or the issues that
     *  stopped it, each NAMING the quantity the driver does not state. A bare null would say only
     *  "cannot simulate", which is what a caller cannot act on. `value` is null with an empty
     *  `errors` when the active topology is one the engine has no model for, or a field this
     *  project itself needs to sweep (its box volume, its drive voltage) is not yet stated. */
    sweep(P: FrequencyGrid): SweepSolveResult {
        const box = this.#engineBoxType();
        if (!box) return {values: null, issues: []};
        const boxIssues = this.#boxSweepIssues(box);
        if (boxIssues.length) return {values: null, issues: boxIssues};
        const params = this.#sweepParams(P, this.driveVoltage_V.value, box);
        return this.#engine.sweep(driverSolverParamsOf(this.driver.specs, this.#engine, this.winisdDriverModel.value, this.#air(this.#root())), this.driver.Le_H() ?? undefined, box, params);
    }

    /** The excursion- and power-limited maximum SPL curves. Reports on the same terms as `sweep`,
     *  but does not need a stated drive level: the engine runs these curves at the 2.83 V
     *  reference whatever `eg` it is handed, so that reference is passed here outright. */
    maxCurves(P: FrequencyGrid): MaxCurvesSolveResult {
        const box = this.#engineBoxType();
        if (!box) return {values: null, issues: [], driverPrerequisites: []};
        const boxIssues = this.#boxSweepIssues(box);
        if (boxIssues.length) return {values: null, issues: boxIssues, driverPrerequisites: []};
        return this.#engine.maxCurves(driverSolverParamsOf(this.driver.specs, this.#engine, this.winisdDriverModel.value, this.#air(this.#root())), this.driver.Le_H() ?? undefined, box, this.#sweepParams(P, 2.83, box));
    }

    /** The active box's own sweep-level blockers, beyond what `solveBoxParams()` already reports:
     *  a vented/bandpass4 port with neither a stated tuning nor a stated port length, or a
     *  passive-radiator mismatch target with neither a stated added mass nor a stated tuning. */
    #boxSweepIssues(box: SimulatableBoxType): readonly SweepIssue[] {
        if (box === 'vented' || box === 'bandpass4') return this.#ventSweepIssues(box);
        if (box === 'box-passive-radiator') return this.#prSweepIssues();
        return [];
    }

    /** The ACTIVE vent's cached issues (`vented`'s or `bandpass4`'s front — S2-7d2:
     *  `#resolve()` already ran `solveVent` for whichever is active, so this is a thin read, not
     *  a second solve). `solveVent`'s issues deliberately stay empty when NO target is stated at
     *  all (pinned by `engine/vent-pr-consistency.test.ts`: "no target chosen yet" is not a
     *  per-field error), so this guard adds the no-resonance case on top: a port that still has
     *  neither `tuning_goal_hz` nor `length_m` blocks the whole sweep, in the terms the sweep's `Leff`
     *  actually runs by. */
    #ventSweepIssues(box: 'vented' | 'bandpass4'): readonly VentIssue[] {
        if (this.#issues.vent.length) return this.#issues.vent;
        const b = this.box;
        const tuningCell = box === 'vented'
            ? b.vented.tuning_goal_hz
            : b.bandpass4.chambers.front.tuning_goal_hz;
        const vent = box === 'vented' ? b.vented.vent : b.bandpass4.vents.front;
        const Vb = box === 'vented'
            ? b.vented.volume_m3.value
            : b.bandpass4.chambers.front.volume_m3.value;
        const lengthCell = vent.length_m;
        if (tuningCell.value == null && lengthCell.value == null) {
            const area = vent.area_m2.value;
            const required = ['tuning_goal_hz', 'Vb_m3', 'area_m2'] as const;
            const values: Readonly<Record<typeof required[number], number | null>> =
                { tuning_goal_hz: null, Vb_m3: Vb, area_m2: area };
            const missing = required.filter((f) => !(typeof values[f] === 'number' && values[f]! > 0));
            return [{
                kind: 'missing-dependencies', target: 'length_m',
                routes: [{formula: 'length_m from tuning_goal_hz + Vb_m3 + area_m2 (Helmholtz)', required, missing}],
            }];
        }
        return [];
    }

    /** The PR equivalent of `#ventSweepIssues` — the cached issues from `#resolve()`'s own
     *  `solvePr` call. A configured radiator with NEITHER target stated still sweeps — that
     *  un-tuned state is simulable (pinned by `test/engine-wiring.test.ts` "a passive-radiator
     *  box simulates"), and `solvePr`'s own issues already stay empty on that terms, so there is
     *  deliberately no extra gate here, unlike `#ventSweepIssues`. */
    #prSweepIssues(): readonly PrIssue[] {
        return this.#issues.pr;
    }

    /** What is wrong with this project's enclosure parameters — checked BEFORE a sweep, so a
     *  caller can refuse rather than plot nonsense. Empty when nothing is wrong, and also empty
     *  (rather than a false accusation) when the topology cannot be simulated at all. */
    boxParamsIssues(): readonly BoxParamsIssue[] {
        const box = this.#engineBoxType();
        return box ? this.#engine.solveBoxParams(box, this.#enclosureParams(box)).issues : [];
    }

    /** The passband level a response is measured against — the reference every dB figure below is
     *  relative to. */
    passbandRef(spl: number[]): number {
        return this.#engine.passbandRef(spl);
    }

    /** The frequency where the response has fallen `dropDb` below its passband — F3 at 3 dB, F6 at
     *  6, and so on. Null when the response never falls that far inside the swept range. */
    rolloffFreq(sw: SweepResult, dropDb: number): number | null {
        return this.#engine.rolloffFreq(sw, dropDb);
    }

    /** A non-finite value anywhere in the response, or null. A sweep that produced NaN is a fault
     *  to report, never a curve to draw. */
    classifyFinite(sw: SweepResult): DriverError | null {
        return this.#engine.classifyFinite(sw);
    }

    /** Finiteness issues split by plotted output, for a caller that renders one chart at a time
     *  and needs one specific cause (BUG_20260906: without this delegate, that caller had no way
     *  to ask the project and reached around it to construct its own `Engine`). */
    classifyFiniteIssues(sw: SweepResult): DriverError[] {
        return this.#engine.classifyFiniteIssues(sw);
    }

    /** A response clamped flat against a limit, or null — a shape that looks like a valid answer
     *  and is not. */
    classifyFlatClamp(sw: SweepResult): DriverError | null {
        return this.#engine.classifyFlatClamp(sw);
    }

    /** The same finiteness check for the max-SPL curves. */
    classifyMaxFinite(mx: MaxCurvesResult): DriverError | null {
        return this.#engine.classifyMaxFinite(mx);
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
        return Re_ohm === null ? null : this.#engine.findImpedancePeak(sw, Re_ohm);
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
        return new CalculatedFieldImpl<number | null>(() => {
            if (this.box.boxType.value !== 'vented') {
                return absentCell<number>('ventAchievedFb');
            }
            const Vb = this.box.vented.volume_m3.value;
            const v = this.box.vented.vent.tuningIn_hz(Vb);
            return v === null
                ? absentCell<number>('ventAchievedFb')
                : calculatedCell<number | null>('ventAchievedFb', v);
        });
    }

    /** The highest tuning this vent can reach in this volume (its L=0 ceiling). A precomputed
     *  readout — not-available when the box is not vented or the geometry is incomplete. */
    get ventMaxReachableFb(): Readable<number | null> & Calculated {
        return new CalculatedFieldImpl<number | null>(() => {
            if (this.box.boxType.value !== 'vented') {
                return absentCell<number>('ventMaxReachableFb');
            }
            const Vb = this.box.vented.volume_m3.value;
            const Sp = this.box.vented.vent.area_m2.value;
            if (!(Vb > 0) || Sp === null) {
                return absentCell<number>('ventMaxReachableFb');
            }
            const count = this.box.vented.vent.count.value;
            const v = this.#engine.tuningFromLength(Vb, 0, Sp, count,
                this.#air(this.#root()),
                this.box.vented.vent.endCorrection_m.value);
            return calculatedCell<number | null>('ventMaxReachableFb', v);
        });
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
