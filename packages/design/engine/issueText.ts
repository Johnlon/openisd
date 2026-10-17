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

/** What each internal quantity key is called in a sentence a person reads (John, 17 Oct 2026:
 *  "internal names like Mms_kg, Fs_hz and Cms_m_per_N leak into user messages everywhere"). */
const PLAIN_NAMES: Readonly<Record<string, string>> = {
  Mms_kg: 'moving mass (Mms)',
  Cms_m_per_N: 'compliance (Cms)',
  Rms_kg_per_s: 'mechanical resistance (Rms)',
  Rme_kg_per_s: 'electrical damping (Rme)',
  Fs_hz: 'resonance (Fs)',
  Vas_m3: 'equivalent volume (Vas)',
  Sd_m2: 'cone area (Sd)',
  Re_ohm: 'coil resistance (Re)',
  Re_terminal_ohm: 'coil resistance at the terminals (Re)',
  BL_terminal_Tm: 'force factor at the terminals (BL)',
  BL_Tm: 'force factor (BL)',
  Xmax_m: 'peak excursion (Xmax)',
  Vb_m3: 'box volume (Vb)',
  volume_m3: 'box volume',
  length_m: 'vent length',
  area_m2: 'vent area',
  tuning_goal_hz: 'tuning',
  addedMass_kg: 'added mass',
  prMmd_kg: 'radiator moving mass',
  prSd_m2: 'radiator cone area',
  prCms_m_per_N: 'radiator compliance',
  voltage_V: 'drive voltage',
  power_W: 'drive power',
  tempK: 'temperature',
};

/** `Mms_kg` to `Mms` when no plain name is listed: drops the unit suffix. */
const UNIT_SUFFIX = /_(?:kg_per_s|m_per_N|N_per_sqrtW|per_K|ohm|kg|hz|m3|m2|Tm|W|V|H|K|Pa|m)$/;

/** A sentence with every internal key (`Mms_kg`, `Fs_hz`) replaced by its plain name. */
export function plainNames(text: string): string {
  return text.replace(/\b[A-Za-z]+(?:_[A-Za-z0-9]+)+\b/g, key => PLAIN_NAMES[key] ?? key.replace(UNIT_SUFFIX, ''));
}
