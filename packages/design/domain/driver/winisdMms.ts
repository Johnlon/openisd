import type { SolverField } from '../../engine/index.js';
import { computedSlot } from './computedSlot.js';
import { OpenIsdDriverSpec } from './openIsdDriverSpec.js';
import { positive } from './positive.js';

/** `Mms = 1/((2π·Fs)²·Cms)` — the moving mass WinISD's own circuit acts on, off the compliance
 *  WinISD itself uses. `spec`'s entered field where Fs or that compliance is not positive. */
export function winisdMms_kg(spec: OpenIsdDriverSpec, Cms: number | null): SolverField<number> {
    const Fs = spec.Fs_hz.value;
    if (!positive(Fs) || !positive(Cms)) return spec.Mms_kg;
    const Mms = 1 / (4 * Math.PI * Math.PI * Fs * Fs * Cms);
    return positive(Mms) ? computedSlot(Mms) : spec.Mms_kg;
}
