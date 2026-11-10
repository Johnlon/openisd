import {type Engine, FixedAir, standaloneChartingSource} from '../../engine/index.js';
import type {Air, ChartingSource} from '../../engine/index.js';

/** What a driver is read with: the air its calculations use and which Cms a datasheet stating both Cms and Vas shows.
 *  Required by every driver; built only by the two factories, the app's (no project) and the project's. */
export class DriverContext {
    private constructor(
        readonly cmsSource: () => ChartingSource | null,
        readonly air: () => Air,
    ) {}

    /** A driver in no project: it shows its datasheet and uses the app's environment defaults, the air a new project would get. */
    static standalone(engine: Engine): DriverContext {
        const env = engine.environment;
        return new DriverContext(
            standaloneChartingSource,
            () => new FixedAir(env.solve({tempK: env.appAir.temperature(), humidityPct: env.appAir.humidity(), pressurePa: env.appAir.pressure()}).values),
        );
    }

    /** A driver in a project, and every copy of it: the project's "Cms from Vas" choice and its live air. */
    static ofProject(cmsSource: () => ChartingSource | null, air: () => Air): DriverContext {
        return new DriverContext(cmsSource, air);
    }
}
