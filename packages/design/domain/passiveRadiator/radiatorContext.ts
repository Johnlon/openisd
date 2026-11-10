import type {Air, ChartingSource, PrEngine, PrSpecValues, ShownMechanics} from '../../engine/index.js';
import {NO_CHART_NOTES, NOTHING_SHOWN, notesFor} from '../driver/chartFigureNote.js';
import type {ChartNotes, NotedFigure} from '../driver/chartFigureNote.js';
import {VAS_WINS} from '../project/chartingSources.js';

/** What a radiator is read with: in a project, the project's air and "Cms from Vas" choice; outside one, its datasheet.
 *  The two subclasses are not assignable to each other, so a place that needs one kind refuses the other. */
export abstract class RadiatorContext {
    /** The mechanical figures the charts use for these stated figures; nothing outside a project (the boxes read the datasheet). */
    abstract shown(stated: PrSpecValues): ShownMechanics;

    /** The notes on the stated figures the charts do not use; none outside a project. */
    abstract chartNotes(stated: PrSpecValues): ChartNotes<NotedFigure>;
}

/** The context of a radiator in a project, and of every copy of it. Built only by the project's box. */
export class RadiatorProjectContext extends RadiatorContext {
    declare private readonly projectBrand: never;

    private constructor(
        private readonly source: () => ChartingSource,
        private readonly air: () => Air,
        private readonly pr: PrEngine,
    ) {
        super();
    }

    /** `pr` is the engine whose one Cms chain works the charts' figures out. */
    static of(source: () => ChartingSource, air: () => Air, pr: PrEngine): RadiatorProjectContext {
        return new RadiatorProjectContext(source, air, pr);
    }

    shown(stated: PrSpecValues): ShownMechanics {
        return this.#under(stated, this.source());
    }

    chartNotes(stated: PrSpecValues): ChartNotes<NotedFigure> {
        return notesFor(this.source(), stated, this.shown(stated), this.#under(stated, VAS_WINS));
    }

    /** The chain under `source`, only for a radiator that states Vas (a radiator stating none is charted with its stated figures). */
    #under(stated: PrSpecValues, source: ChartingSource): ShownMechanics {
        return stated.Vas_m3 === null ? NOTHING_SHOWN : this.pr.shownMechanics(stated, this.air(), source);
    }
}

/** The context of a radiator the app manages outside any project (My PRs, the catalogue, the wizard's copy): it shows its datasheet. */
export class RadiatorAppContext extends RadiatorContext {
    declare private readonly managedBrand: never;

    private constructor() {
        super();
    }

    static of(): RadiatorAppContext {
        return new RadiatorAppContext();
    }

    shown(): ShownMechanics {
        return NOTHING_SHOWN;
    }

    chartNotes(): ChartNotes<NotedFigure> {
        return NO_CHART_NOTES;
    }
}
