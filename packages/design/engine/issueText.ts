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
