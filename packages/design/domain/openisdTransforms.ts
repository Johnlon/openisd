// Conversion utilities mapping unvalidated input -> domain classes -> project states.
// These only depend on public methods from `openisdDomain.ts` and schemas from `openisdSchema.ts`.
// Layout: exported functions -> private helpers -> builder classes.

import {
    emptyBoxJson,
    type OpenISDDeviceJson,
    type OpenISDBoxJson,
    type OpenISDProjectJson,
} from './openisdSchema.js';
import {
    OpenISDDriver,
    OpenISDPassiveRadiatorStandalone,
    OpenISDProject,
} from './openisdDomain.js';
import {Engine} from '../engine/index.js';

// ── VALIDATION HELPERS — private to this file ──────────────────────────────────────────────

/**
 * The ONE wording for the shape both seams refuse identically. A caller that asks both seams and
 * merges their findings de-duplicates by value, so two paraphrases of this one condition reach a
 * reader as two separate complaints about the same record.
 */
const TWO_THINGS_AT_ONCE = 'both a driver section and a passive-radiator section — this record is two things at once';

export function driverSectionProblems(json: OpenISDDeviceJson): string[] {
    const specs = json.specs;
    if (specs.woofer === undefined && specs.tweeter === undefined) {
        return ['neither a woofer nor a tweeter section — nothing to simulate'];
    }
    if (specs['passive-radiator'] !== undefined) {
        return [TWO_THINGS_AT_ONCE];
    }
    return [];
}

export function radiatorSectionProblems(json: OpenISDDeviceJson): string[] {
    const specs = json.specs;
    if (specs['passive-radiator'] === undefined) {
        return ['no passive-radiator section — this record is not a radiator'];
    }
    if (specs.woofer !== undefined || specs.tweeter !== undefined) {
        return [TWO_THINGS_AT_ONCE];
    }
    return [];
}


// ── BUILDING A PROJECT — the wizard's path in, and the only way to make an `OpenISDProject` ──

export class ProjectBuilder {
    readonly #driver: OpenISDDriver;
    readonly #engine: Engine;

    constructor(driver: OpenISDDriver, engine: Engine) {
        this.#driver = driver;
        this.#engine = engine;
    }

    sealed(): SealedProjectBuilder {
        return new SealedProjectBuilder(this.#driver, this.#engine);
    }

    vented(): VentedProjectBuilder {
        return new VentedProjectBuilder(this.#driver, this.#engine);
    }

    bandpass4(): Bandpass4ProjectBuilder {
        return new Bandpass4ProjectBuilder(this.#driver, this.#engine);
    }

    bandpass6(): TwoChamberProjectBuilder {
        return new TwoChamberProjectBuilder(this.#driver, this.#engine, 'bandpass6');
    }

    abc(): TwoChamberProjectBuilder {
        return new TwoChamberProjectBuilder(this.#driver, this.#engine, 'abc');
    }

    passiveRadiator(): PassiveRadiatorProjectBuilder {
        return new PassiveRadiatorProjectBuilder(this.#driver, this.#engine);
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

    protected constructor(driver: OpenISDDriver, engine: Engine) {
        this.driver = driver;
        this.engine = engine;
    }

    /** The chosen radiator, for the builders that take one. */
    protected radiatorChoice: OpenISDPassiveRadiatorStandalone | null = null;

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
    prototypeProjectJson(driver: OpenISDDeviceJson): OpenISDProjectJson {
        return {
            driverEmbedding: {
                device: {...driver},
                nDrivers: 1,
                wiring: 'parallel',
                vcTempRise_K: 0,
                Rs_ohm: 0,
                driverAddedMass_kg: 0,
                alfaVC_per_K: 0,
                loading: 'standard',
            },
            box: emptyBoxJson(),
            environment: {temperature_K: null, humidity_pct: null, pressure_Pa: null, useWinisdAirModel: null},
            signal: {power_W: null, voltage_V: null},
            meta: {name: '', creator: '', created: '', modified: '', description: ''},
            filters: {filters: []},
            advanced: {
                forceFlatResponse: false,
                useTransmissionLinePortModel: false,
                rgAtDriverSide: false,
                circuitModel: 'winisd',
                splGraphIsXmaxLimited: false,
            },
            charts: {perTab: {}},
        };
    }
}

class SealedProjectBuilder extends BoxProjectBuilder {
    #volume: number | null = null;

    constructor(driver: OpenISDDriver, engine: Engine) {
        super(driver, engine);
    }

    volume_m3(v: number): this {
        this.#volume = v;
        return this;
    }

    protected boxRecord(): OpenISDBoxJson {
        const box = emptyBoxJson();
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

    constructor(driver: OpenISDDriver, engine: Engine) {
        super(driver, engine);
    }

    volume_m3(v: number): this {
        this.#volume = v;
        return this;
    }

    tuning_hz(v: number): this {
        this.#tuning = v;
        return this;
    }

    protected boxRecord(): OpenISDBoxJson {
        const box = emptyBoxJson();
        return {
            ...box,
            boxType: 'vented',
            vented: {
                ...box.vented,
                chamber: {
                    ...box.vented.chamber,
                    volume_m3: BoxProjectBuilder.required(this.#volume, 'vented volume_m3'),
                    tuning_hz: BoxProjectBuilder.required(this.#tuning, 'vented tuning_hz'),
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

    constructor(driver: OpenISDDriver, engine: Engine) {
        super(driver, engine);
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
        const box = emptyBoxJson();
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
                    tuning_hz: R(this.#frontTuning, 'bandpass4 frontTuning_hz'),
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

    constructor(driver: OpenISDDriver, engine: Engine, kind: 'bandpass6' | 'abc') {
        super(driver, engine);
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
        const box = emptyBoxJson();
        const R = BoxProjectBuilder.required;
        const k = this.#kind;
        const chambers = {
            rear: {
                ...box[k].rear,
                volume_m3: R(this.#rearVolume, `${k} rearVolume_m3`),
                tuning_hz: R(this.#rearTuning, `${k} rearTuning_hz`),
            },
            front: {
                ...box[k].front,
                volume_m3: R(this.#frontVolume, `${k} frontVolume_m3`),
                tuning_hz: R(this.#frontTuning, `${k} frontTuning_hz`),
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

    constructor(driver: OpenISDDriver, engine: Engine) {
        super(driver, engine);
    }

    volume_m3(v: number): this {
        this.#volume = v;
        return this;
    }

    tuning_hz(v: number): this {
        this.#tuning = v;
        return this;
    }

    count(v: number): this {
        this.#count = v;
        return this;
    }

    /** Takes an ALREADY-VALIDATED radiator, from `passiveRadiatorFromConformingRecord()`. Kept as
     *  the OBJECT; `build()` has the box's own radiator copy it in. */
    radiator(radiator: OpenISDPassiveRadiatorStandalone): this {
        this.radiatorChoice = radiator;
        return this;
    }

    protected boxRecord(): OpenISDBoxJson {
        const box = emptyBoxJson();
        const R = BoxProjectBuilder.required;
        if (!this.radiatorChoice) throw new Error('build(): a passive-radiator box requires a radiator');
        // `component` stays null HERE and is filled by `build()`, which has the box's own radiator
        // adopt the chosen one — the record is private to the radiator, so the builder cannot copy
        // it across itself.
        return {
            ...box,
            boxType: 'box-passive-radiator',
            passiveRadiator: {
                ...box.passiveRadiator,
                volume_m3: R(this.#volume, 'passive-radiator volume_m3'),
                tuning_hz: R(this.#tuning, 'passive-radiator tuning_hz'),
                count: this.#count,
            },
        };
    }
}
