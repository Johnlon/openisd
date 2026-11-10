import {type Engine, FixedAir, standaloneChartingSource} from '../../engine/index.js';
import type {Air, ChartingSource} from '../../engine/index.js';

/** What a driver is read with: the air its calculations use and which Cms a datasheet stating both Cms and Vas shows.
 *  Only the two subclasses below exist, and they are not assignable to each other, so a place that needs one kind refuses the other. */
export abstract class DriverContext {
    protected constructor(
        readonly cmsSource: () => ChartingSource | null,
        readonly air: () => Air,
    ) {}
}

/** The context of a driver in a project, and of every copy of it (the editor's working copy, a copy saved from it). Built only by the project. */
export class ProjectContext extends DriverContext {
    declare private readonly projectBrand: never;

    private constructor(cmsSource: () => ChartingSource | null, air: () => Air) {
        super(cmsSource, air);
    }

    /** A driver in a project, and every copy of it: the project's "Cms from Vas" choice and its live air. */
    static of(cmsSource: () => ChartingSource | null, air: () => Air): ProjectContext {
        return new ProjectContext(cmsSource, air);
    }
}

/** The context of a driver the app manages outside any project (My Drivers, the catalogue, the New Driver editor). Its one factory is `of`. */
export class AppContext extends DriverContext {
    declare private readonly managedBrand: never;

    private constructor(cmsSource: () => ChartingSource | null, air: () => Air) {
        super(cmsSource, air);
    }

    /** A managed driver, edited while any project is open, is read in the app's air (the one a new project would get) and shows its datasheet, never a project's. */
    static of(engine: Engine): AppContext {
        const env = engine.environment;
        return new AppContext(
            standaloneChartingSource,
            () => new FixedAir(env.solve({tempK: env.appAir.temperature(), humidityPct: env.appAir.humidity(), pressurePa: env.appAir.pressure()}).values),
        );
    }
}
