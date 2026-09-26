// Conversion utilities mapping unvalidated input -> domain classes -> project states.
// These only depend on public methods from `openisdDomain.ts` and schemas from `openisdSchema.ts`.
// Layout: exported functions -> private helpers -> builder classes.

import {
    type DriverDeviceJson,
    emptyBoxJson,
    enteredEntry,
    type OpenISDBoxJson,
    type OpenISDProjectJson,
} from './openisdSchema.js';
import {OpenISDDriver, OpenISDPassiveRadiatorStandalone, OpenISDProject,} from './openisdDomain.js';
import {Engine} from '../engine/index.js';
import {DEFAULT_SOURCE_RESISTANCE_OHM} from '../fields/index.js';
import {type AppContext, dateStamp, realAppContext} from './appContext.js';

// ── BUILDING A PROJECT — the wizard's path in, and the only way to make an `OpenISDProject` ──

export class ProjectBuilder {
    readonly #driver: OpenISDDriver;
    readonly #engine: Engine;
    readonly #appContext: AppContext;

    constructor(driver: OpenISDDriver, engine: Engine, appContext: AppContext = realAppContext) {
        this.#driver = driver;
        this.#engine = engine;
        this.#appContext = appContext;
    }

    sealed(): SealedProjectBuilder {
        return new SealedProjectBuilder(this.#driver, this.#engine, this.#appContext);
    }

    vented(): VentedProjectBuilder {
        return new VentedProjectBuilder(this.#driver, this.#engine, this.#appContext);
    }

    bandpass4(): Bandpass4ProjectBuilder {
        return new Bandpass4ProjectBuilder(this.#driver, this.#engine, this.#appContext);
    }

    bandpass6(): TwoChamberProjectBuilder {
        return new TwoChamberProjectBuilder(this.#driver, this.#engine, 'bandpass6', this.#appContext);
    }

    abc(): TwoChamberProjectBuilder {
        return new TwoChamberProjectBuilder(this.#driver, this.#engine, 'abc', this.#appContext);
    }

    passiveRadiator(): PassiveRadiatorProjectBuilder {
        return new PassiveRadiatorProjectBuilder(this.#driver, this.#engine, this.#appContext);
    }
}

/** Shared assembly. Each specialised builder decides the box record; this turns it into a
 *  managed project, so there is ONE place a project comes into existence. */
export abstract class BoxProjectBuilder {
    /** The driver OBJECT, not its record. A record could not be read out of it anyway — only
     *  `OpenISDDriver` and its subclasses can reach a driver's storage — and it does not need to
     *  be: `build()` hands the object to the project's own embedded driver, which copies it in. */
    protected readonly driver: OpenISDDriver;
    /** The one calculation surface, on its way to the project this builder will assemble. */
    protected readonly engine: Engine;
    /** The project's fresh identity comes from here, not from a direct `newUuid()` call — see
     *  `appContext.ts`. */
    protected readonly appContext: AppContext;

    protected constructor(driver: OpenISDDriver, engine: Engine, appContext: AppContext) {
        this.driver = driver;
        this.engine = engine;
        this.appContext = appContext;
    }

    /** An inert box holding a blank radiator. */
    protected emptyBox(): OpenISDBoxJson {
        return emptyBoxJson(OpenISDPassiveRadiatorStandalone.empty(this.engine, this.appContext).clonePassiveRadiator());
    }

    /** The chosen radiator. */
    protected radiatorChoice: OpenISDPassiveRadiatorStandalone | null = null;

    /**
     * Selects the radiator this project's passive-radiator box holds, in place of the blank one.
     * Available on EVERY builder: a project carries its radiator whatever box type is active.
     *
     * Takes an ALREADY-VALIDATED radiator. Kept as the OBJECT; `build()` has the box's own
     * radiator copy it in, since the record is private to the radiator.
     */
    radiator(radiator: OpenISDPassiveRadiatorStandalone): this {
        this.radiatorChoice = radiator;
        return this;
    }

    protected abstract boxRecord(): OpenISDBoxJson;

    protected static required(value: number | null, what: string): number {
        if (value === null) throw new Error(`build(): ${what} is required`);
        return value;
    }

    /**
     * Assemble the project — the LAST thing, once every part has been collected.
     *
     * The driver goes in AS THE RECORD IS BUILT. A builder and a driver are sibling domain classes
     * in this module, so reading the driver's record here is friend access, which this module has
     * and uses; there is no boundary to cross. Constructing a blank driver first and overwriting
     * it one line later invented a record for a driver that was already in hand.
     */
    build(): OpenISDProject {
        const project = OpenISDProject.wrap(
            {...this.prototypeProjectJson(this.driver.toOpenIsdDeviceJson()), box: this.boxRecord()},
            this.engine,
            this.appContext,
        );
        if (this.radiatorChoice) project.box.passiveRadiator.radiator.update(this.radiatorChoice);
        // Those writes land in `#edited`, because every write does. A project the user has just
        // created has no UNSAVED changes, though — so the assembled state IS its saved baseline.
        // Without this a new project is born modified, and Cancel would discard its own driver.
        project.save();
        return project;
    }

    /**
     * A new project's record: the chosen driver, the box being built, and defaults for everything a
     * project has not been told yet.
     *
     * THE DRIVER IS A PARAMETER because a project cannot exist without one — `OpenISDProject.builder()` takes a
     * validated `OpenISDDriver` before a builder is even returned. Copied on the way in (`{...}`), so
     * the project owns its own record and later edits do not reach back into a My Drivers entry or a
     * bundle row.
     *
     * NOTE TO AGENT - JL Hates this function which creates a half baked project from a driver, but leaves all the fields with crappy values
     * like null and I really struggle to understand why so bad given its actually called from the builder
     * and the builder should really be constructing a finished project not this crap - John things it should DIE.
     * And in the builder we have crappy things like this following which instantly overwrites bits of it...
     * if (this.radiatorChoice) project.box.passiveRadiator.radiator.update(this.radiatorChoice);
     */
    prototypeProjectJson(driver: DriverDeviceJson): OpenISDProjectJson {
        return {
            driverEmbedding: {
                device: {...driver},
                nDrivers: 1,
                wiring: 'parallel',
                vcTempRise_K: 0,
                Rs_ohm: DEFAULT_SOURCE_RESISTANCE_OHM,
                driverAddedMass_kg: 0,
                alfaVC_per_K: 0.0039,
                loading: 'standard',
            },
            box: this.emptyBox(),
            // The three conditions state nothing; the project's first resolve stamps the app's
            // Options → Environment value into each as a 'C' entry.
            environment: {useWinisdAirModel: null},
            signal: {},
            meta: {
                name: '',
                // Blank, never a guess, when the platform user is not known — `''` is the only
                // way this plain-string config field (no provenance) can spell absence.
                creator: this.appContext.platformUser() ?? '',
                created: dateStamp(this.appContext.now()),
                modified: dateStamp(this.appContext.now()),
                description: '',
            },
            filters: {filters: []},
            advanced: {
                forceFlatResponse: false,
                useTransmissionLinePortModel: false,
                rgAtDriverSide: false,
                circuitModel: 'winisd',
                splGraphIsXmaxLimited: false,
                useWinisdDriverModel: false,
            },
            charts: {},
        };
    }
}

class SealedProjectBuilder extends BoxProjectBuilder {
    #volume: number | null = null;

    constructor(driver: OpenISDDriver, engine: Engine, appContext: AppContext) {
        super(driver, engine, appContext);
    }

    volume_m3(v: number): this {
        this.#volume = v;
        return this;
    }

    protected boxRecord(): OpenISDBoxJson {
        const box = this.emptyBox();
        return {
            ...box,
            boxType: 'sealed',
            sealed: {...box.sealed, volume_m3: BoxProjectBuilder.required(this.#volume, 'sealed volume_m3')},
        };
    }
}

class VentedProjectBuilder extends BoxProjectBuilder {
    #volume: number | null = null;
    #tuning: number | null = null;

    constructor(driver: OpenISDDriver, engine: Engine, appContext: AppContext) {
        super(driver, engine, appContext);
    }

    volume_m3(v: number): this {
        this.#volume = v;
        return this;
    }

    tuning_goal_hz(v: number): this {
        this.#tuning = v;
        return this;
    }

    protected boxRecord(): OpenISDBoxJson {
        const box = this.emptyBox();
        return {
            ...box,
            boxType: 'vented',
            vented: {
                ...box.vented,
                chamber: {
                    ...box.vented.chamber,
                    volume_m3: BoxProjectBuilder.required(this.#volume, 'vented volume_m3'),
                    tuning_goal_hz: enteredEntry(BoxProjectBuilder.required(this.#tuning, 'vented tuning_goal_hz')),
                },
            },
        };
    }
}

/** Bandpass 4th order: a SEALED rear chamber (no tuning of its own — its resonance is
 *  calculated) and a vented front one. */
class Bandpass4ProjectBuilder extends BoxProjectBuilder {
    #rearVolume: number | null = null;
    #frontVolume: number | null = null;
    #frontTuning: number | null = null;

    constructor(driver: OpenISDDriver, engine: Engine, appContext: AppContext) {
        super(driver, engine, appContext);
    }

    rearVolume_m3(v: number): this {
        this.#rearVolume = v;
        return this;
    }

    frontVolume_m3(v: number): this {
        this.#frontVolume = v;
        return this;
    }

    frontTuning_hz(v: number): this {
        this.#frontTuning = v;
        return this;
    }

    protected boxRecord(): OpenISDBoxJson {
        const box = this.emptyBox();
        const R = BoxProjectBuilder.required;
        return {
            ...box,
            boxType: 'bandpass4',
            bandpass4: {
                ...box.bandpass4,
                rear: {...box.bandpass4.rear, volume_m3: R(this.#rearVolume, 'bandpass4 rearVolume_m3')},
                front: {
                    ...box.bandpass4.front,
                    volume_m3: R(this.#frontVolume, 'bandpass4 frontVolume_m3'),
                    tuning_goal_hz: enteredEntry(R(this.#frontTuning, 'bandpass4 frontTuning_hz')),
                },
            },
        };
    }
}

/** Bandpass 6th order and ABC: two INDEPENDENTLY tunable chambers. Identical to build — they
 *  differ in their ports (ABC adds a third, connecting one), which is set afterwards through
 *  the box surface, not here. */
class TwoChamberProjectBuilder extends BoxProjectBuilder {
    readonly #kind: 'bandpass6' | 'abc';
    #rearVolume: number | null = null;
    #rearTuning: number | null = null;
    #frontVolume: number | null = null;
    #frontTuning: number | null = null;

    constructor(driver: OpenISDDriver, engine: Engine, kind: 'bandpass6' | 'abc', appContext: AppContext) {
        super(driver, engine, appContext);
        this.#kind = kind;
    }

    rearVolume_m3(v: number): this {
        this.#rearVolume = v;
        return this;
    }

    rearTuning_hz(v: number): this {
        this.#rearTuning = v;
        return this;
    }

    frontVolume_m3(v: number): this {
        this.#frontVolume = v;
        return this;
    }

    frontTuning_hz(v: number): this {
        this.#frontTuning = v;
        return this;
    }

    protected boxRecord(): OpenISDBoxJson {
        const box = this.emptyBox();
        const R = BoxProjectBuilder.required;
        const k = this.#kind;
        const chambers = {
            rear: {
                ...box[k].rear,
                volume_m3: R(this.#rearVolume, `${k} rearVolume_m3`),
                tuning_goal_hz: enteredEntry(R(this.#rearTuning, `${k} rearTuning_hz`)),
            },
            front: {
                ...box[k].front,
                volume_m3: R(this.#frontVolume, `${k} frontVolume_m3`),
                tuning_goal_hz: enteredEntry(R(this.#frontTuning, `${k} frontTuning_hz`)),
            },
        };
        return {...box, boxType: k, [k]: {...box[k], ...chambers}};
    }
}

/** A passive-radiator box cannot be valid without a RADIATOR — the one box type whose builder
 *  demands a second component, which is exactly why it has a builder of its own. */
class PassiveRadiatorProjectBuilder extends BoxProjectBuilder {
    #volume: number | null = null;
    #tuning: number | null = null;
    #count = 1;

    constructor(driver: OpenISDDriver, engine: Engine, appContext: AppContext) {
        super(driver, engine, appContext);
    }

    volume_m3(v: number): this {
        this.#volume = v;
        return this;
    }

    tuning_goal_hz(v: number): this {
        this.#tuning = v;
        return this;
    }

    count(v: number): this {
        this.#count = v;
        return this;
    }

    protected boxRecord(): OpenISDBoxJson {
        const box = this.emptyBox();
        const R = BoxProjectBuilder.required;
        if (!this.radiatorChoice) throw new Error('build(): a passive-radiator box requires a radiator');
        return {
            ...box,
            boxType: 'box-passive-radiator',
            passiveRadiator: {
                ...box.passiveRadiator,
                volume_m3: R(this.#volume, 'passive-radiator volume_m3'),
                tuning_goal_hz: enteredEntry(R(this.#tuning, 'passive-radiator tuning_goal_hz')),
                count: this.#count,
            },
        };
    }
}
