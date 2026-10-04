import {LossMode} from '../../fields/lossMode.js';

/** The WinISD-vs-conventional choices: WinISD's convention or another model. None is a WinISD bug. */
export interface ConventionChoices {
    /** Sealed-box loss model. */
    readonly lossMode: LossMode;
    /** "WinISD phase wrapping": phase wrapped to ±180°; off, continuous. */
    readonly winisdWrapPhase: boolean;
    /** "WinISD driver count": N drivers as N single-driver boxes; off, N coils wired into one load. */
    readonly winisdDriverCountModel: boolean;
    /** "WinISD flat response": force flat to the TF 0 dB, uncapped; off, boost only, capped. */
    readonly winisdFlatModel: boolean;
    /** "WinISD ABC intra-port velocity": WinISD's simplification without the leak term; off, exact. */
    readonly winisdAbcIntraPortVelocity: boolean;
}

/** The WinISD error switches (the yellow "WinISD errors" group): on reproduces a straight WinISD bug. */
export interface ErrorChoices {
    readonly winisdDriverModel: boolean;
    readonly winisdVaModel: boolean;
    readonly winisdPrNprResonance: boolean;
    readonly winisdBesselHighpass: boolean;
}

/** Every choice a preset sets. */
export type CompatChoices = ConventionChoices & ErrorChoices;

/** Per choice, whether two sets agree. A choice added to `CompatChoices` fails to compile here. */
const SAME: Readonly<{[K in keyof CompatChoices]: (a: CompatChoices, b: CompatChoices) => boolean}> = Object.freeze({
    lossMode: (a, b) => a.lossMode === b.lossMode,
    winisdWrapPhase: (a, b) => a.winisdWrapPhase === b.winisdWrapPhase,
    winisdDriverCountModel: (a, b) => a.winisdDriverCountModel === b.winisdDriverCountModel,
    winisdFlatModel: (a, b) => a.winisdFlatModel === b.winisdFlatModel,
    winisdAbcIntraPortVelocity: (a, b) => a.winisdAbcIntraPortVelocity === b.winisdAbcIntraPortVelocity,
    winisdDriverModel: (a, b) => a.winisdDriverModel === b.winisdDriverModel,
    winisdVaModel: (a, b) => a.winisdVaModel === b.winisdVaModel,
    winisdPrNprResonance: (a, b) => a.winisdPrNprResonance === b.winisdPrNprResonance,
    winisdBesselHighpass: (a, b) => a.winisdBesselHighpass === b.winisdBesselHighpass,
});

const WINISD_CONVENTIONS: ConventionChoices = Object.freeze({
    lossMode: LossMode.WinisdLossy,
    winisdWrapPhase: true,
    winisdDriverCountModel: true,
    winisdFlatModel: true,
    winisdAbcIntraPortVelocity: true,
});

const ERRORS_FIXED: ErrorChoices = Object.freeze({
    winisdDriverModel: false,
    winisdVaModel: false,
    winisdPrNprResonance: false,
    winisdBesselHighpass: false,
});

/**
 * A WinISD Compatibility preset (John, 2026-10-04): a full set of WinISD-vs-conventional choices
 * and error switches. Applying one never changes a native WinISD control or project data.
 */
export class CompatPreset {
    private constructor(readonly label: string, readonly description: string, readonly choices: CompatChoices) {}

    /** OpenISD's best model for every choice, every WinISD bug fixed. */
    static readonly DEBUGGED = new CompatPreset(
        'Recommended (debugged)',
        'OpenISD\'s most accurate models throughout (conventional loss model, exact ABC intra-port velocity, wired driver arrays, capped flat response, continuous phase), every known WinISD bug fixed.',
        Object.freeze({
            lossMode: LossMode.ConventionalLossy,
            winisdWrapPhase: false,
            winisdDriverCountModel: false,
            winisdFlatModel: false,
            winisdAbcIntraPortVelocity: false,
            ...ERRORS_FIXED,
        }));

    /** WinISD's conventions, every WinISD bug fixed. The default. */
    static readonly WINISD_ISH = new CompatPreset(
        'WinISD-ish',
        'WinISD\'s own models and conventions, with every known WinISD bug fixed. The default.',
        Object.freeze({...WINISD_CONVENTIONS, ...ERRORS_FIXED}));

    /** Exact WinISD reproduction: WinISD's conventions and every WinISD error switch ticked. */
    static readonly WINISD_WITH_BUGS = new CompatPreset(
        'WinISD incl. bugs',
        'Reproduces WinISD exactly: WinISD\'s models and conventions, and every WinISD error switch ticked. Use it to compare with WinISD, not to design.',
        Object.freeze({
            ...WINISD_CONVENTIONS,
            winisdDriverModel: true,
            winisdVaModel: true,
            winisdPrNprResonance: true,
            winisdBesselHighpass: true,
        }));

    /** What a new project, or a file that does not say, has. */
    static get DEFAULT(): CompatPreset { return CompatPreset.WINISD_ISH; }

    /** `choices` are exactly this preset's. */
    matches(choices: CompatChoices): boolean {
        return Object.values(SAME).every(same => same(this.choices, choices));
    }

    /** What the panel shows for the preset the project matches: its label, or "Custom". */
    static labelOf(preset: CompatPreset | null): string {
        return preset?.label ?? 'Custom';
    }

    /** The preset `choices` are, or null for a custom mix. */
    static of(choices: CompatChoices): CompatPreset | null {
        return CompatPreset.ALL.find(p => p.matches(choices)) ?? null;
    }

    /** Every preset, in button order; declared last. */
    static readonly ALL: readonly CompatPreset[] =
        Object.freeze(Object.values(CompatPreset).filter((v): v is CompatPreset => v instanceof CompatPreset));
}
