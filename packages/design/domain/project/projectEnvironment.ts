import type { EnvironmentEngine } from '../../engine/index.js';
import { defaultingEntryField, focus } from '../cell.js';
import type { SimpleField } from '../cell.js';
import type { EnvironmentCondition, OpenISDEnvironmentJson } from '../openisdSchema.js';
import type { EnvironmentField, EnvironmentFields } from './environmentFields.js';

/** The three environment conditions over `environment`, each reading the app's Options →
 *  Environment value as C when not entered. Shared by `ProjectEnvironment`'s notifying getters
 *  below and, directly, by `OpenISDProject#resolve()`/`#airOver` — the same split `driverOver`/
 *  `boxOver` have between a notifying `#root()` and a direct one (S2-7d2). */
export function envFieldsOver(environment: SimpleField<OpenISDEnvironmentJson>, engine: EnvironmentEngine): EnvironmentFields {
    const field = (key: EnvironmentCondition, fallback: () => number): EnvironmentField =>
        defaultingEntryField(focus(environment, key), key, fallback);
    return {
        tempK: field('temperature_K', () => engine.defaults().tempK),
        humidityPct: field('humidity_pct', () => engine.defaults().humidityPct),
        pressurePa: field('pressure_Pa', () => engine.defaults().pressurePa),
    };
}

/** A project's own environment window, built fresh on every access — same reasoning as
 *  `driver`/`box`/`ProjectMeta` (PLAN_openisdproject_split.md). */
export class ProjectEnvironment {
    readonly #lens: SimpleField<OpenISDEnvironmentJson>;
    readonly #engine: EnvironmentEngine;

    constructor(lens: SimpleField<OpenISDEnvironmentJson>, engine: EnvironmentEngine) {
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
