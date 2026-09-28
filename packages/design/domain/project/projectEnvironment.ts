import type { Engine } from '../../engine/index.js';
import { defaultingEntryField, focus } from '../cell.js';
import type { SimpleField } from '../cell.js';
import type { EnvironmentCondition, OpenISDEnvironmentJson } from '../openisdSchema.js';
import type { EnvironmentField, EnvironmentFields } from './environmentFields.js';

/** The three environment conditions over `environment`, each reading the app's Options →
 *  Environment value as C when not entered. Shared by `ProjectEnvironment`'s notifying getters
 *  below and, directly, by `OpenISDProject#resolve()`/`#airOver` — the same split `driverOver`/
 *  `boxOver` have between a notifying `#root()` and a direct one (S2-7d2). */
export function envFieldsOver(environment: SimpleField<OpenISDEnvironmentJson>, engine: Engine): EnvironmentFields {
    const field = (key: EnvironmentCondition, fallback: () => number): EnvironmentField =>
        defaultingEntryField(focus(environment, key), key, fallback);
    return {
        tempK: field('temperature_K', () => engine.envDefaults().tempK),
        humidityPct: field('humidity_pct', () => engine.envDefaults().humidityPct),
        pressurePa: field('pressure_Pa', () => engine.envDefaults().pressurePa),
    };
}

/** A project's own environment window, built fresh on every access — same reasoning as
 *  `driver`/`box`/`ProjectMeta` (PLAN_openisdproject_split.md). */
export class ProjectEnvironment {
    static wrap(lens: SimpleField<OpenISDEnvironmentJson>, engine: Engine): ProjectEnvironment {
        return new ProjectEnvironment(lens, engine);
    }

    readonly #lens: SimpleField<OpenISDEnvironmentJson>;
    readonly #engine: Engine;

    private constructor(lens: SimpleField<OpenISDEnvironmentJson>, engine: Engine) {
        this.#lens = lens;
        this.#engine = engine;
    }

    /** This project's air temperature, WinISD Advanced "Temperature". E when typed, else C: the
     *  app's Options → Environment value (`Engine.envDefaults()`), which the resolve also
     *  stores. */
    get tempK(): EnvironmentField {
        return envFieldsOver(this.#lens, this.#engine).tempK;
    }

    /** This project's relative humidity, WinISD Advanced "Humidity". Stored the same way as
     *  `tempK`. */
    get humidityPct(): EnvironmentField {
        return envFieldsOver(this.#lens, this.#engine).humidityPct;
    }

    /** This project's atmospheric pressure, WinISD Advanced "Pressure". Stored the same way as
     *  `tempK`. */
    get pressurePa(): EnvironmentField {
        return envFieldsOver(this.#lens, this.#engine).pressurePa;
    }

    /** Which air formula this project's sweeps use — WinISD's parity model when true, OpenISD's
     *  physical CIPM-2007 model when false. Null reads as true (QO95): a new project matches
     *  WinISD out of the box. See `engine/air.ts` for the two models. */
    get useWinisdAirModel(): SimpleField<boolean> {
        const slot = this.#lens;
        return {
            get value() { return slot.value.useWinisdAirModel ?? true; },
            set: (useWinisdAirModel: boolean) => {
                slot.set({ ...slot.value, useWinisdAirModel });
            },
        };
    }
}
