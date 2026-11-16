/**
 * The measured wiring of a multi-coil driver, inferred where its title prints a per-coil nominal
 * impedance (QO903 R4): Re at least 1.5 × the per-coil nominal is series, at most 0.6 × is
 * parallel, anything between is not inferred. The result is a calculated suggestion with its
 * reason, used only to make rewiring possible; a stated wiring always wins over it.
 */
import type {Wiring} from '../../engine/index.js';

/** At or above this multiple of the per-coil nominal, Re is the coils in series. */
const SERIES_AT_LEAST = 1.5;
/** At or below this multiple of the per-coil nominal, Re is the coils in parallel. */
const PARALLEL_AT_MOST = 0.6;

const NUMBER = String.raw`(\d+(?:\.\d+)?)`;
const OHM = String.raw`(?:ohms?|Ω)`;

/** Title wordings that print one coil's nominal impedance, the number in group 1, matched
 *  ignoring case: "N Ohms Per Coil", "Dual N Ohm", "2 x N ohm", "N + N Ω", a "-DN" or " DN" suffix. */
const PER_COIL_NOMINAL: readonly string[] = Object.freeze([
    String.raw`${NUMBER}\s*-?\s*${OHM}\s*per\s*coil`,
    String.raw`\bdual\s*${NUMBER}\s*-?\s*${OHM}`,
    String.raw`\b\d\s*[x×]\s*${NUMBER}\s*-?\s*${OHM}`,
    String.raw`${NUMBER}\s*\+\s*\1\s*${OHM}`,
    String.raw`(?:^|[\s-])D\s?${NUMBER}\s*$`,
]);

/** Title wordings that name several voice coils without printing a per-coil nominal. */
const MULTI_COIL_WORDS = /\b(?:DVC|QVC|dual\s+voice\s+coils?)\b/i;

/** One coil's nominal impedance as the title prints it; null when it prints none. */
export function perCoilNominal_ohm(title: string): number | null {
    for (const pattern of PER_COIL_NOMINAL) {
        const match = new RegExp(pattern, 'i').exec(title);
        if (match !== null) {
            const n = Number(match[1]);
            if (n > 0) return n;
        }
    }
    return null;
}

/** Whether the title says the driver has more than one voice coil. */
export function titleNamesSeveralCoils(title: string): boolean {
    return MULTI_COIL_WORDS.test(title) || perCoilNominal_ohm(title) !== null;
}

/** The wiring a measured Re implies against a printed per-coil nominal. */
export interface WiringInference {
    /** Null when Re sits between the two thresholds. */
    readonly wiring: Wiring | null;
    readonly Re_ohm: number;
    readonly perCoilNominal_ohm: number;
}

/** The wiring inferred for a driver of `numVC` coils with resistance `Re_ohm` and title `title`;
 *  null when there is nothing to infer from: fewer than 2 coils, no Re, or no printed per-coil
 *  nominal. */
export function inferMeasuredWiring(title: string, Re_ohm: number | null, numVC: number | null): WiringInference | null {
    if (numVC === null || numVC < 2 || Re_ohm === null) return null;
    const nominal = perCoilNominal_ohm(title);
    if (nominal === null) return null;
    const ratio = Re_ohm / nominal;
    const wiring: Wiring | null = ratio >= SERIES_AT_LEAST ? 'series' : ratio <= PARALLEL_AT_MOST ? 'parallel' : null;
    return {wiring, Re_ohm, perCoilNominal_ohm: nominal};
}
