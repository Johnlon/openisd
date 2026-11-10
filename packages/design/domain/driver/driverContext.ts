import {type Engine, FixedAir} from '../../engine/index.js';
import type {Air, ChartingSource, DriverEngine, DriverValues, ShownMechanics} from '../../engine/index.js';
import {VAS_WINS} from '../project/chartingSources.js';
import {NO_CHART_NOTES, NOTHING_SHOWN, notesFor} from './chartFigureNote.js';
import type {ChartNotes, NotedFigure, StatedMechanics} from './chartFigureNote.js';

/** What a driver is read with: the air its calculations use, and how the charts' Cms, Mms and Rms are worked out for a datasheet that states both Cms and Vas.
 *  Only the two subclasses below exist, and they are not assignable to each other, so a place that needs one kind refuses the other. */
export abstract class DriverContext {
    protected constructor(readonly air: () => Air) {}

    /** The mechanical figures the charts use for these stored figures, in `air`; nothing for a driver outside a project (its boxes read the datasheet). */
    abstract shown(values: DriverValues, air: Air): ShownMechanics;

    /** The notes on the stated figures the charts do not use; none for a driver outside a project. */
    abstract chartNotes(stated: StatedMechanics, values: DriverValues, air: Air): ChartNotes<NotedFigure>;
}

/** The context of a driver in a project, and of every copy of it (the editor's working copy, a copy saved from it). Built only by the project. */
export class ProjectContext extends DriverContext {
    private constructor(
        private readonly source: () => ChartingSource,
        air: () => Air,
        private readonly driver: DriverEngine,
    ) {
        super(air);
    }

    /** A driver in a project, and every copy of it: the project's "Cms from Vas" choice, its live air, and the engine's one Cms chain. */
    static of(source: () => ChartingSource, air: () => Air, driver: DriverEngine): ProjectContext {
        return new ProjectContext(source, air, driver);
    }

    shown(values: DriverValues, air: Air): ShownMechanics {
        return this.driver.shownMechanics(values, air, this.source());
    }

    chartNotes(stated: StatedMechanics, values: DriverValues, air: Air): ChartNotes<NotedFigure> {
        return notesFor(this.source(), stated, this.shown(values, air), this.driver.shownMechanics(values, air, VAS_WINS));
    }
}

/** The context of a driver the app manages outside any project (My Drivers, the catalogue, the New Driver editor). Its one factory is `of`. */
export class AppContext extends DriverContext {
    /** What this kind shows: the datasheet, no figure worked out and no note. Held here so the type is its own (a project's context is not assignable to it). */
    readonly #shown = NOTHING_SHOWN;
    readonly #notes = NO_CHART_NOTES;

    private constructor(air: () => Air) {
        super(air);
    }

    /** A managed driver, edited while any project is open, is read in the app's air (the one a new project would get) and shows its datasheet, never a project's. */
    static of(engine: Engine): AppContext {
        const env = engine.environment;
        return new AppContext(
            () => new FixedAir(env.solve({tempK: env.appAir.temperature(), humidityPct: env.appAir.humidity(), pressurePa: env.appAir.pressure()}).values),
        );
    }

    shown(): ShownMechanics {
        return this.#shown;
    }

    chartNotes(): ChartNotes<NotedFigure> {
        return this.#notes;
    }
}
