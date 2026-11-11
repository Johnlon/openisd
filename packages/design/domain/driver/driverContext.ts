import {type Engine, FixedAir} from '../../engine/index.js';
import type {Air} from '../../engine/index.js';

/** What a driver is read with: the air its calculations use, and whether the project's What-if panel is editing it.
 *  Only the two subclasses below exist, and they are not assignable to each other (each has its own `kind`),
 *  so a place that needs one kind refuses the other. */
export abstract class DriverContext {
    /** The air the driver's calculations use. */
    abstract readonly air: () => Air;

    /** True while the What-if panel is open: a typed figure moves the figures that follow it (QO535) and no box is marked. */
    abstract readonly inWhatIf: () => boolean;
}

/** The context of a driver in a project, and of every copy of it (the editor's working copy, a copy saved from it). Built only by the project. */
export class ProjectContext extends DriverContext {
    readonly kind = 'project' as const;

    private constructor(readonly air: () => Air, readonly inWhatIf: () => boolean) {
        super();
    }

    /** A driver in a project, and every copy of it: the project's live air and its What-if state. */
    static of(air: () => Air, inWhatIf: () => boolean): ProjectContext {
        return new ProjectContext(air, inWhatIf);
    }
}

/** The context of a driver the app manages outside any project (My Drivers, the catalogue, the New Driver editor). Its one factory is `of`. */
export class AppContext extends DriverContext {
    readonly kind = 'app' as const;
    readonly #engine: Engine;

    private constructor(engine: Engine) {
        super();
        this.#engine = engine;
    }

    /** A managed driver, edited while any project is open, is read in the app's air (the one a new project would get), and never in a What-if. */
    static of(engine: Engine): AppContext {
        return new AppContext(engine);
    }

    readonly air = (): Air => {
        const env = this.#engine.environment;
        return new FixedAir(env.solve({tempK: env.appAir.temperature(), humidityPct: env.appAir.humidity(), pressurePa: env.appAir.pressure()}).values);
    };

    readonly inWhatIf = (): boolean => false;
}
