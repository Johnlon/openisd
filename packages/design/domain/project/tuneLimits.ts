/**
 * The six limits the Tune view checks a vented design against, and the colour state each value
 * gets. Pure: numbers in, a `LimitState` out. The limits are not stored in the project yet; a
 * caller hands them in (`TuneLimits`), blank by default.
 */

/** A limit someone typed: finite and above zero, checked once by `parseLimit`. Each unit has its
 *  own class, so a volume limit cannot stand in for a frequency limit. The literal `brand` field makes
 *  the classes nominally different without a cast. */
export abstract class Limit {
    protected constructor(readonly value: number) {}
}

export class F3Limit_hz extends Limit {
    readonly brand = 'F3Limit_hz';
    static of(value: number): F3Limit_hz { return new F3Limit_hz(value); }
}
export class VolumeLimit_L extends Limit {
    readonly brand = 'VolumeLimit_L';
    static of(value: number): VolumeLimit_L { return new VolumeLimit_L(value); }
}
export class VentSpeedLimit_m_per_s extends Limit {
    readonly brand = 'VentSpeedLimit_m_per_s';
    static of(value: number): VentSpeedLimit_m_per_s { return new VentSpeedLimit_m_per_s(value); }
}
export class VentLengthLimit_cm extends Limit {
    readonly brand = 'VentLengthLimit_cm';
    static of(value: number): VentLengthLimit_cm { return new VentLengthLimit_cm(value); }
}
export class ExcursionLimit_mm extends Limit {
    readonly brand = 'ExcursionLimit_mm';
    static of(value: number): ExcursionLimit_mm { return new ExcursionLimit_mm(value); }
}
export class VentDiameterLimit_cm extends Limit {
    readonly brand = 'VentDiameterLimit_cm';
    static of(value: number): VentDiameterLimit_cm { return new VentDiameterLimit_cm(value); }
}

/** The numbers Tune reads a design by. `null` is a value the design does not give. */
export interface TuneReading {
    readonly f3_hz: number | null;
    readonly vb_L: number;
    readonly ventSpeed_m_per_s: number | null;
    readonly ventLength_cm: number | null;
    readonly excursion_mm: number | null;
    readonly ventDiameter_cm: number | null;
}

export type LimitDirection = 'atMost' | 'atLeast';

/** One thing Tune limits. The class is the kind: `LimitKind.F3_MAX.read(reading)` needs no key. */
export class LimitKind<L extends Limit> {
    static readonly F3_MAX = new LimitKind<F3Limit_hz>('F3', 'Hz', 'atMost', F3Limit_hz.of, r => r.f3_hz);
    static readonly VB_MAX = new LimitKind<VolumeLimit_L>('Box volume', 'L', 'atMost', VolumeLimit_L.of, r => r.vb_L);
    static readonly VENT_SPEED_MAX = new LimitKind<VentSpeedLimit_m_per_s>('Vent speed', 'm/s', 'atMost', VentSpeedLimit_m_per_s.of, r => r.ventSpeed_m_per_s);
    static readonly VENT_LENGTH_MAX = new LimitKind<VentLengthLimit_cm>('Vent length', 'cm', 'atMost', VentLengthLimit_cm.of, r => r.ventLength_cm);
    static readonly XMAX_MAX = new LimitKind<ExcursionLimit_mm>('Cone excursion', 'mm', 'atMost', ExcursionLimit_mm.of, r => r.excursion_mm);
    static readonly VENT_DIAMETER_MIN = new LimitKind<VentDiameterLimit_cm>('Vent diameter', 'cm', 'atLeast', VentDiameterLimit_cm.of, r => r.ventDiameter_cm);

    private constructor(
        readonly label: string,
        readonly unit: string,
        readonly direction: LimitDirection,
        readonly make: (value: number) => L,
        /** The number this kind limits, read from a reading. */
        readonly read: (result: TuneReading) => number | null,
    ) {}

}

/** What typing into a limit box gave. Blank is "no limit", never 0. */
export type LimitParse<L extends Limit> =
    | { readonly kind: 'blank' }
    | { readonly kind: 'valid'; readonly limit: L }
    | { readonly kind: 'invalid' };

/** Turn typed text or a number into a limit. Blank text is no limit; non-finite or <= 0 is
 *  invalid. After this the value is trusted. */
export function parseLimit<L extends Limit>(kind: LimitKind<L>, input: string | number): LimitParse<L> {
    if (typeof input === 'string' && input.trim() === '') return {kind: 'blank'};
    const value = typeof input === 'string' ? Number(input) : input;
    if (!Number.isFinite(value) || value <= 0) return {kind: 'invalid'};
    return {kind: 'valid', limit: kind.make(value)};
}

/** How a value stands against its limit. `margin` and `over` are fractions of the limit. */
export type LimitState =
    | { readonly kind: 'none' }
    | { readonly kind: 'ok'; readonly margin: number }
    | { readonly kind: 'amber'; readonly margin: number }
    | { readonly kind: 'red'; readonly over: number };

export interface LimitStateCases<R> {
    readonly none: () => R;
    readonly ok: (margin: number) => R;
    readonly amber: (margin: number) => R;
    readonly red: (over: number) => R;
}

export const LimitState = {
    /** Exhaustive: a new state fails to compile until every caller handles it. */
    match<R>(state: LimitState, cases: LimitStateCases<R>): R {
        switch (state.kind) {
            case 'none': return cases.none();
            case 'ok': return cases.ok(state.margin);
            case 'amber': return cases.amber(state.margin);
            case 'red': return cases.red(state.over);
        }
    },
} as const;

/** Share of the limit inside which a value turns amber. */
const AMBER_BAND = 0.1;
const NONE: LimitState = Object.freeze({kind: 'none'});

/** No limit or no value: none. At most: over the limit is red, within 10 % below it is amber
 *  (exactly at the limit is amber). At least: under the limit is red, within 10 % above it is
 *  amber. */
export function limitState<L extends Limit>(kind: LimitKind<L>, value: number | null, limit: L | null): LimitState {
    if (limit === null || value === null || !Number.isFinite(value)) return NONE;
    const cap = limit.value;
    const atMost = kind.direction === 'atMost';
    const beyond = atMost ? value > cap : value < cap;
    const nearEdge = atMost ? value >= (1 - AMBER_BAND) * cap : value <= (1 + AMBER_BAND) * cap;
    const fraction = Math.abs(cap - value) / cap;
    if (beyond) return {kind: 'red', over: fraction};
    return nearEdge ? {kind: 'amber', margin: fraction} : {kind: 'ok', margin: fraction};
}

/** The six limits, each blank (`null`) until someone types one. */
export class TuneLimits {
    static readonly NONE = new TuneLimits(null, null, null, null, null, null);

    constructor(
        readonly f3: F3Limit_hz | null,
        readonly vb: VolumeLimit_L | null,
        readonly ventSpeed: VentSpeedLimit_m_per_s | null,
        readonly ventLength: VentLengthLimit_cm | null,
        readonly xmax: ExcursionLimit_mm | null,
        readonly ventDiameter: VentDiameterLimit_cm | null,
    ) {}
}

/** One typed getter per limit kind: where every value of a reading stands. */
export class TuneStates {
    readonly f3: LimitState;
    readonly vb: LimitState;
    readonly ventSpeed: LimitState;
    readonly ventLength: LimitState;
    readonly xmax: LimitState;
    readonly ventDiameter: LimitState;

    constructor(reading: TuneReading, limits: TuneLimits) {
        this.f3 = limitState(LimitKind.F3_MAX, LimitKind.F3_MAX.read(reading), limits.f3);
        this.vb = limitState(LimitKind.VB_MAX, LimitKind.VB_MAX.read(reading), limits.vb);
        this.ventSpeed = limitState(LimitKind.VENT_SPEED_MAX, LimitKind.VENT_SPEED_MAX.read(reading), limits.ventSpeed);
        this.ventLength = limitState(LimitKind.VENT_LENGTH_MAX, LimitKind.VENT_LENGTH_MAX.read(reading), limits.ventLength);
        this.xmax = limitState(LimitKind.XMAX_MAX, LimitKind.XMAX_MAX.read(reading), limits.xmax);
        this.ventDiameter = limitState(LimitKind.VENT_DIAMETER_MIN, LimitKind.VENT_DIAMETER_MIN.read(reading), limits.ventDiameter);
    }
}
