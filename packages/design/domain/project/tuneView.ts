import type {SweepResult} from '../../engine/index.js';
import {NumberField} from '../../fields/field.js';
import type {FieldLimits} from '../../fields/filterLimits.js';
import {TuneText} from '../../fields/tuneText.js';
import type {FrequencyGrid} from '../box/frequencyGrid.js';
import type {OpenISDProject} from './openISDProject.js';
import {TuneLimits, TuneStates} from './tuneLimits.js';
import type {TuneReading} from './tuneLimits.js';

export interface TuneCurve {
    readonly fs: readonly number[];
    readonly spl: readonly number[];
}

export interface TunePoint {
    readonly f_hz: number;
    readonly spl_db: number;
}

const L_PER_M3 = 1000;
const CM_PER_M = 100;
const MM_PER_M = 1000;

/** `read` applied to `value`, or null when there is no value. */
export function whenKnown<T, U>(value: T | null, read: (known: T) => U | null): U | null {
    return value === null ? null : read(value);
}

/** One design swept: the sweep and what Tune reads off it. Null when the design has no volume or
 *  will not sweep. */
interface Parts {
    readonly sw: SweepResult;
    readonly reading: TuneReading;
}

function partsOf(project: OpenISDProject, grid: FrequencyGrid): Parts | null {
    const vb_m3 = project.box.vented.volume_m3.value;
    if (vb_m3 === null) return null;
    const sw = project.sweep(grid).values;
    if (sw === null) return null;
    const peaks = project.peaks(sw);
    const fb_hz = project.box.vented.tuning_goal_hz.value;
    const vent = project.box.vented.vent;
    const length_m = whenKnown(fb_hz, fb => vent.lengthForTuning_m(vb_m3, fb));
    const diameter_m = vent.diameter_m.value;
    return {
        sw,
        reading: {
            f3_hz: project.rolloffFreq(sw, 3),
            vb_L: vb_m3 * L_PER_M3,
            ventSpeed_m_per_s: peaks.ventSpeed_m_per_s,
            ventLength_cm: whenKnown(length_m, m => m * CM_PER_M),
            excursion_mm: whenKnown(peaks.excursion_m, m => m * MM_PER_M),
            ventDiameter_cm: whenKnown(diameter_m, m => m * CM_PER_M),
        },
    };
}

/** The F3 marker on the curve: F3 itself, 3 dB under the passband. */
export function f3PointOf(f3_hz: number | null, passbandRef_db: number): TunePoint | null {
    return f3_hz === null ? null : {f_hz: f3_hz, spl_db: passbandRef_db - 3};
}

function curveOf(sw: SweepResult): TuneCurve {
    return {fs: [...sw.fs], spl: [...sw.spl]};
}

/** Tune on a design that cannot be tuned: not vented, no driver, or it will not sweep. */
export interface TuneUnavailable {
    readonly applies: false;
    readonly note: string;
}

/** Everything the Tune view shows, computed by the design. */
export interface TuneAvailable {
    readonly applies: true;
    /** The committed design. */
    readonly saved: TuneReading;
    /** The design now, with the What-if layer if one is open. */
    readonly now: TuneReading;
    readonly states: TuneStates;
    readonly curve: TuneCurve;
    readonly savedCurve: TuneCurve;
    readonly f3Point: TunePoint | null;
    readonly f10_hz: number | null;
    readonly vbRange_L: FieldLimits;
    readonly fbRange_hz: FieldLimits;
}

export type TuneView = TuneUnavailable | TuneAvailable;

const UNAVAILABLE: TuneUnavailable = Object.freeze({applies: false, note: TuneText.NOT_VENTED_NOTE});

/** Build the Tune view of `project`, swept over `grid`, with its limits blank unless given. */
export function tuneViewOf(
    project: OpenISDProject,
    grid: FrequencyGrid,
    limits: TuneLimits = TuneLimits.NONE,
): TuneView {
    if (project.box.boxType.value !== 'vented') return UNAVAILABLE;
    const now = partsOf(project, grid);
    if (now === null) return UNAVAILABLE;
    const saved = project.isWhatIfActive() ? partsOf(project.committedSnapshot(), grid) : now;
    if (saved === null) return UNAVAILABLE;

    return {
        applies: true,
        saved: saved.reading,
        now: now.reading,
        states: new TuneStates(now.reading, limits),
        curve: curveOf(now.sw),
        savedCurve: curveOf(saved.sw),
        f3Point: f3PointOf(now.reading.f3_hz, project.passbandRef(now.sw.spl)),
        f10_hz: project.rolloffFreq(now.sw, 10),
        vbRange_L: NumberField.BOX_VB_L.limits,
        fbRange_hz: NumberField.BOX_FB_HZ.limits,
    };
}
