import { OpenIsdDriverSpec } from './openIsdDriverSpec.js';
import { positive } from './positive.js';

/** `BL² = Re/(2π·Fs·Qes·Cms)` at the terminals — the motor strength WinISD's
 *  `Rae = 1/(2π·Fs·Qes'·Ccas)` implies, off the compliance WinISD itself uses. `entered` where Re,
 *  Fs, Qes or that compliance is not positive. */
export function winisdBLterminal_Tm(spec: OpenIsdDriverSpec, Re_terminal_ohm: number | null, Cms: number | null, entered: number | null): number | null {
    const Fs = spec.Fs_hz.value, Qes = spec.Qes.value;
    if (!positive(Re_terminal_ohm) || !positive(Fs) || !positive(Qes) || !positive(Cms)) return entered;
    const BL = Math.sqrt(Re_terminal_ohm / (2 * Math.PI * Fs * Qes * Cms));
    return positive(BL) ? BL : entered;
}
