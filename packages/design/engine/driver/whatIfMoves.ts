/**
 * The What-if panel's rule for a typed driver figure (QO535, John 11 Nov 2026: "what if is all about tweaking things you need to buy a
 * different driver to obtain, ie experiments and learning"). The boxes always agree, so every move is the same proportion the physics gives,
 * applied to the value the box shows: a figure the datasheet rounded keeps its rounding.
 *
 * - A result (Fs, Vas, Qes, Qms, Qts, SPL) typed: the other results stay where they can; the parts (Mms, Cms, Rms, Bl) move.
 *   Qts and SPL move Qes through Bl; Qms stays.
 * - A part (Mms, Cms, Rms, Bl, Sd, Re) typed: the other parts stay; the results that depend on it follow (Mms moves Fs and the Q's, not Vas).
 *
 * The relations, with the parts fixed by the wiring: Fs ∝ 1/√(Mms·Cms), Vas ∝ Sd²·Cms, Qms ∝ √(Mms/Cms)/Rms, Qes ∝ √(Mms/Cms)·Re/Bl²,
 * Qts = Qes·Qms/(Qes+Qms), SPL = constant + 10·log₁₀(Fs³·Vas/Qes).
 */

/** The figures the rule reads and moves, as the boxes show them; null where a box is empty. */
export interface WhatIfFigures {
  readonly Fs_hz: number | null;
  readonly Vas_m3: number | null;
  readonly Qes: number | null;
  readonly Qms: number | null;
  readonly Qts: number | null;
  readonly SPL_dB: number | null;
  readonly Mms_kg: number | null;
  readonly Cms_m_per_N: number | null;
  readonly Rms_kg_per_s: number | null;
  readonly BL_Tm: number | null;
  readonly Sd_m2: number | null;
  readonly Re_ohm: number | null;
}

/** A figure the What-if rule applies to. */
export type WhatIfFigure = keyof WhatIfFigures;

/** Every `WhatIfFigure`, once. */
export const WHAT_IF_FIGURES = Object.freeze([
  'Fs_hz', 'Vas_m3', 'Qes', 'Qms', 'Qts', 'SPL_dB', 'Mms_kg', 'Cms_m_per_N', 'Rms_kg_per_s', 'BL_Tm', 'Sd_m2', 'Re_ohm',
] as const satisfies readonly WhatIfFigure[]);
type _MissingWhatIfFigure = Exclude<WhatIfFigure, typeof WHAT_IF_FIGURES[number]>;
const _whatIfFiguresComplete: _MissingWhatIfFigure extends never ? true : never = true;
void _whatIfFiguresComplete;

/** The figures a typed one moves, each with its new value. A figure that does not move, or whose box is empty, is absent. */
export type WhatIfMoves = Partial<Record<WhatIfFigure, number>>;

const positive = (x: number | null): x is number => x !== null && Number.isFinite(x) && x > 0;

/** `Qes·Qms/(Qes+Qms)`. */
const parallelQ = (Qes: number, Qms: number): number => Qes * Qms / (Qes + Qms);

/** `value` scaled by `factor`, or nothing when the box is empty. */
function scaled(value: number | null, factor: number): number | null {
  return positive(value) ? value * factor : null;
}

/** `SPL` moved by `dB`, or nothing when the box is empty (an SPL may be any finite number). */
function shifted(SPL: number | null, dB: number): number | null {
  return SPL !== null && Number.isFinite(SPL) ? SPL + dB : null;
}

/** The moves as a record without the empty ones. */
function moves(entries: readonly (readonly [WhatIfFigure, number | null])[]): WhatIfMoves {
  const out: Partial<Record<WhatIfFigure, number>> = {};
  for (const [figure, value] of entries) if (value !== null && Number.isFinite(value)) out[figure] = value;
  return out;
}

/** Qes set to `Qes` with Fs, Vas and Qms kept: Bl moves (Qes ∝ 1/Bl²), Qts and SPL follow. */
function qesMoves(shown: WhatIfFigures, Qes: number): readonly (readonly [WhatIfFigure, number | null])[] {
  if (!positive(shown.Qes) || !positive(Qes)) return [];
  const ratio = Qes / shown.Qes;
  return [
    ['BL_Tm', scaled(shown.BL_Tm, 1 / Math.sqrt(ratio))],
    ['Qts', positive(shown.Qms) ? parallelQ(Qes, shown.Qms) : null],
    ['SPL_dB', shifted(shown.SPL_dB, -10 * Math.log10(ratio))],
  ];
}

/** Every figure that moves when `figure` is typed as `value`, from the figures the boxes show now. The typed figure itself is not listed. */
export function whatIfMoves(figure: WhatIfFigure, value: number, shown: WhatIfFigures): WhatIfMoves {
  if (!Number.isFinite(value)) return {};
  switch (figure) {
    case 'Fs_hz': {
      if (!positive(shown.Fs_hz) || !positive(value)) return {};
      const r = value / shown.Fs_hz;
      // Cms stays (Vas stays): Mms ∝ 1/Fs²; Rms and Bl keep Qms and Qes.
      return moves([
        ['Mms_kg', scaled(shown.Mms_kg, 1 / (r * r))],
        ['Rms_kg_per_s', scaled(shown.Rms_kg_per_s, 1 / r)],
        ['BL_Tm', scaled(shown.BL_Tm, 1 / Math.sqrt(r))],
        ['SPL_dB', shifted(shown.SPL_dB, 30 * Math.log10(r))],
      ]);
    }
    case 'Vas_m3': {
      if (!positive(shown.Vas_m3) || !positive(value)) return {};
      const r = value / shown.Vas_m3;
      // Sd stays: Cms ∝ Vas; Fs stays: Mms ∝ 1/Cms; Rms and Bl keep Qms and Qes.
      return moves([
        ['Cms_m_per_N', scaled(shown.Cms_m_per_N, r)],
        ['Mms_kg', scaled(shown.Mms_kg, 1 / r)],
        ['Rms_kg_per_s', scaled(shown.Rms_kg_per_s, 1 / r)],
        ['BL_Tm', scaled(shown.BL_Tm, 1 / Math.sqrt(r))],
        ['SPL_dB', shifted(shown.SPL_dB, 10 * Math.log10(r))],
      ]);
    }
    case 'Qes':
      return moves(qesMoves(shown, value));
    case 'Qms': {
      if (!positive(shown.Qms) || !positive(value)) return {};
      return moves([
        ['Rms_kg_per_s', scaled(shown.Rms_kg_per_s, shown.Qms / value)],
        ['Qts', positive(shown.Qes) ? parallelQ(shown.Qes, value) : null],
      ]);
    }
    case 'Qts': {
      // Qms stays, so Qes is what gives: Qes = Qts·Qms/(Qms−Qts). A Qts at or above Qms has no Qes.
      if (!positive(shown.Qms) || !positive(value) || value >= shown.Qms) return {};
      const Qes = value * shown.Qms / (shown.Qms - value);
      return moves([['Qes', Qes], ...qesMoves(shown, Qes).filter(([f]) => f !== 'Qts')]);
    }
    case 'SPL_dB': {
      // Fs and Vas stay, so Qes is what gives: SPL rises 10·log₁₀ of the drop in Qes.
      if (shown.SPL_dB === null || !Number.isFinite(shown.SPL_dB) || !positive(shown.Qes)) return {};
      const Qes = shown.Qes * Math.pow(10, -(value - shown.SPL_dB) / 10);
      return moves([['Qes', Qes], ...qesMoves(shown, Qes).filter(([f]) => f !== 'SPL_dB')]);
    }
    case 'Mms_kg': {
      if (!positive(shown.Mms_kg) || !positive(value)) return {};
      const r = value / shown.Mms_kg;
      const Qes = scaled(shown.Qes, Math.sqrt(r));
      const Qms = scaled(shown.Qms, Math.sqrt(r));
      return moves([
        ['Fs_hz', scaled(shown.Fs_hz, 1 / Math.sqrt(r))],
        ['Qes', Qes], ['Qms', Qms],
        ['Qts', Qes !== null && Qms !== null ? parallelQ(Qes, Qms) : null],
        ['SPL_dB', shifted(shown.SPL_dB, -20 * Math.log10(r))],
      ]);
    }
    case 'Cms_m_per_N': {
      if (!positive(shown.Cms_m_per_N) || !positive(value)) return {};
      const r = value / shown.Cms_m_per_N;
      const Qes = scaled(shown.Qes, 1 / Math.sqrt(r));
      const Qms = scaled(shown.Qms, 1 / Math.sqrt(r));
      // SPL does not move: Fs³·Vas/Qes keeps its value when only Cms changes.
      return moves([
        ['Fs_hz', scaled(shown.Fs_hz, 1 / Math.sqrt(r))],
        ['Vas_m3', scaled(shown.Vas_m3, r)],
        ['Qes', Qes], ['Qms', Qms],
        ['Qts', Qes !== null && Qms !== null ? parallelQ(Qes, Qms) : null],
      ]);
    }
    case 'Rms_kg_per_s': {
      if (!positive(shown.Rms_kg_per_s) || !positive(value)) return {};
      const Qms = scaled(shown.Qms, shown.Rms_kg_per_s / value);
      return moves([
        ['Qms', Qms],
        ['Qts', Qms !== null && positive(shown.Qes) ? parallelQ(shown.Qes, Qms) : null],
      ]);
    }
    case 'BL_Tm': {
      if (!positive(shown.BL_Tm) || !positive(value)) return {};
      const r = value / shown.BL_Tm;
      const Qes = scaled(shown.Qes, 1 / (r * r));
      return moves([
        ['Qes', Qes],
        ['Qts', Qes !== null && positive(shown.Qms) ? parallelQ(Qes, shown.Qms) : null],
        ['SPL_dB', shifted(shown.SPL_dB, 20 * Math.log10(r))],
      ]);
    }
    case 'Sd_m2': {
      if (!positive(shown.Sd_m2) || !positive(value)) return {};
      const r = value / shown.Sd_m2;
      return moves([
        ['Vas_m3', scaled(shown.Vas_m3, r * r)],
        ['SPL_dB', shifted(shown.SPL_dB, 20 * Math.log10(r))],
      ]);
    }
    case 'Re_ohm': {
      if (!positive(shown.Re_ohm) || !positive(value)) return {};
      const r = value / shown.Re_ohm;
      const Qes = scaled(shown.Qes, r);
      return moves([
        ['Qes', Qes],
        ['Qts', Qes !== null && positive(shown.Qms) ? parallelQ(Qes, shown.Qms) : null],
        ['SPL_dB', shifted(shown.SPL_dB, -10 * Math.log10(r))],
      ]);
    }
  }
}
