import type { SolverField } from '../../engine/index.js';
import { computedSlot } from './computedSlot.js';
import { OpenIsdDriverSpec } from './openIsdDriverSpec.js';
import { positive } from './positive.js';

/** `Rms = 2π·Fs·Mms/Qms` — the mechanical loss WinISD's `Ram = 1/(2π·Fs·Qms·Ccas)` implies, off the
 *  same moving mass. `spec`'s entered field where Fs, Qms or that mass is not positive. */
export function winisdRms_kg_per_s(spec: OpenIsdDriverSpec, mms: SolverField<number>): SolverField<number> {
    const Fs = spec.Fs_hz.value, Qms = spec.Qms.value, Mms = mms.value;
    if (!positive(Fs) || !positive(Qms) || !positive(Mms)) return spec.Rms_kg_per_s;
    const Rms = 2 * Math.PI * Fs * Mms / Qms;
    return positive(Rms) ? computedSlot(Rms) : spec.Rms_kg_per_s;
}
