/**
 * Number and label formatting shared by the sentences a `DqIssue` carries. Nothing here knows
 * what an issue is — it exists so `consistency.ts` and `plausibility.ts` can each build their own
 * variants' text without importing each other (`plausibility.ts` declares the types
 * `consistency.ts`'s `DqIssue` unions together, so a dependency the other way is a cycle).
 */
import type {VentedDesignQuantity} from './plausibility.js';

/** A near-miss needs its decimal to be readable; a gross one is quoted whole. */
export function pct(relative: number): string {
  const p = relative * 100;
  return p >= 100 ? `${Math.round(p)}%` : `${p.toFixed(1)}%`;
}

/** Readable at a glance: one decimal for anything a person would read as a number, two
 *  significant figures for the very small values an extrapolated alignment produces. */
export function decimal(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  return Math.abs(v) < 0.1 && v !== 0 ? v.toPrecision(2) : String(Math.round(v * 10) / 10);
}

/** The value as the user reads it on screen: volumes in litres, tunings in hertz. */
export function quantified(quantity: VentedDesignQuantity, value: number): string {
  switch (quantity) {
    case 'Vb': return `${decimal(value * 1000)} L`;
    case 'Fb': return `${decimal(value)} Hz`;
  }
}

export function subject(quantity: VentedDesignQuantity): string {
  switch (quantity) {
    case 'Vb': return 'Box volume';
    case 'Fb': return 'Tuning';
  }
}

/** Every plausibility sentence ends in the same fact, because it is the fact that decides what a
 *  reader does next: the number is not a bug, it is WinISD's own answer, kept deliberately. */
export const PARITY = 'WinISD gives the same answer, and OpenISD keeps it rather than quietly changing it.';

/** What an internal quantity key is called in a sentence a person reads (John, 17 Oct 2026:
 *  "internal names like Mms_kg, Fs_hz and Cms_m_per_N leak into user messages everywhere").
 *  A key with no listed name loses its unit suffix: `Mpow_N_per_sqrtW` reads `Mpow`. */
function plainName(key: string): string {
  switch (key) {
    case 'Mms_kg': return 'moving mass (Mms)';
    case 'Cms_m_per_N': return 'compliance (Cms)';
    case 'Rms_kg_per_s': return 'mechanical resistance (Rms)';
    case 'Rme_kg_per_s': return 'electrical damping (Rme)';
    case 'Fs_hz': return 'resonance (Fs)';
    case 'Vas_m3': return 'equivalent volume (Vas)';
    case 'Sd_m2': return 'cone area (Sd)';
    case 'Re_ohm': return 'coil resistance (Re)';
    case 'Re_terminal_ohm': return 'coil resistance at the terminals (Re)';
    case 'BL_terminal_Tm': return 'force factor at the terminals (BL)';
    case 'BL_Tm': return 'force factor (BL)';
    case 'Xmax_m': return 'peak excursion (Xmax)';
    case 'Vb_m3': return 'box volume (Vb)';
    case 'volume_m3': return 'box volume';
    case 'length_m': return 'vent length';
    case 'area_m2': return 'vent area';
    case 'tuning_goal_hz': return 'tuning';
    case 'addedMass_kg': return 'added mass';
    case 'prMmd_kg': return 'radiator moving mass';
    case 'prSd_m2': return 'radiator cone area';
    case 'prCms_m_per_N': return 'radiator compliance';
    case 'voltage_V': return 'drive voltage';
    case 'power_W': return 'drive power';
    case 'tempK': return 'temperature';
    default: return key.replace(/_(?:kg_per_s|m_per_N|N_per_sqrtW|per_K|ohm|kg|hz|m3|m2|Tm|W|V|H|K|Pa|m)$/, '');
  }
}

/** A sentence with every internal key (`Mms_kg`, `Fs_hz`) replaced by its plain name. */
export function plainNames(text: string): string {
  return text.replace(/\b[A-Za-z]+(?:_[A-Za-z0-9]+)+\b/g, plainName);
}
