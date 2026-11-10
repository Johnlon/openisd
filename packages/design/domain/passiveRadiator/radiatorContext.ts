import type {Air, ChartingSource, CmsResolveInput, ShownMechanics} from '../../engine/index.js';

/** What a radiator is read with: in a project, the project's air and "Cms from Vas" choice; outside one, its datasheet.
 *  The two subclasses are not assignable to each other, so a place that needs one kind refuses the other. */
export abstract class RadiatorContext {
    /** The answer for a radiator in a project (its context) or outside one. */
    abstract fold<T>(inProject: (project: RadiatorProjectContext) => T, outside: () => T): T;
}

/** The context of a radiator in a project, and of every copy of it. Built only by the project's box. */
export class RadiatorProjectContext extends RadiatorContext {
    declare private readonly projectBrand: never;

    private constructor(
        readonly cmsSource: () => ChartingSource | null,
        readonly air: () => Air,
        readonly mechanics: (source: ChartingSource, input: CmsResolveInput, air: Air) => ShownMechanics,
    ) {
        super();
    }

    /** `mechanics` is the engine's one Cms chain, handed in by the project's box. */
    static of(
        cmsSource: () => ChartingSource | null,
        air: () => Air,
        mechanics: (source: ChartingSource, input: CmsResolveInput, air: Air) => ShownMechanics,
    ): RadiatorProjectContext {
        return new RadiatorProjectContext(cmsSource, air, mechanics);
    }

    fold<T>(inProject: (project: RadiatorProjectContext) => T): T {
        return inProject(this);
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

    fold<T>(_inProject: (project: RadiatorProjectContext) => T, outside: () => T): T {
        return outside();
    }
}
