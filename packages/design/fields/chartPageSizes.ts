import {PhoneRowSizes} from './phoneRowSizes.js';

/**
 * How big the parts of the classic phone Graph page are: the chart bar, the band over each chart,
 * the Tune / What-if button strip and the two sheets. The UI reads them as the CSS variables
 * `cssVars()` names; it never picks a size of its own.
 */
export class ChartPageSizes {
  static readonly CLASSIC = new ChartPageSizes({
    headPadYPx: 8, headControlPx: 40, headSavePx: 44, perScreenWidthPx: 104,
    bandPx: 28, barPadYPx: 6, barGapPx: 6,
    legendLinePx: 16, sheetMaxPx: 250, sheetBandPx: 24,
  });

  private constructor(readonly values: ChartPageSizesValues) {}

  /** Chart bar height: the controls, the padding above and below, and the 1 px rule. */
  barHeightPx(): number { return this.values.headControlPx + 2 * this.values.headPadYPx + 1; }

  /** Button strip height: the one phone button (PhoneRowSizes.BUTTON_PX) and the padding above and below. */
  stripHeightPx(): number { return PhoneRowSizes.BUTTON_PX + 2 * this.values.barPadYPx + 1; }

  /** The sizes as CSS custom properties. */
  cssVars(): ReadonlyMap<string, string> {
    const s = this.values;
    return new Map([
      ['--gp-head-h', `${this.barHeightPx()}px`],
      ['--gp-head-pad-y', `${s.headPadYPx}px`],
      ['--gp-head-control', `${s.headControlPx}px`],
      ['--gp-head-save', `${s.headSavePx}px`],
      ['--gp-per-w', `${s.perScreenWidthPx}px`],
      ['--gp-band', `${s.bandPx}px`],
      ['--gp-tap', `${PhoneRowSizes.BUTTON_PX}px`],
      ['--gp-bar-pad-y', `${s.barPadYPx}px`],
      ['--gp-bar-gap', `${s.barGapPx}px`],
      ['--gp-legend-line', `${s.legendLinePx}px`],
      ['--gp-sheet-max', `${s.sheetMaxPx}px`],
      ['--gp-sheet-band', `${s.sheetBandPx}px`],
    ]);
  }
}

export interface ChartPageSizesValues {
  /** Padding above and below the chart bar's controls. */
  readonly headPadYPx: number;
  /** Height of the menu, chart picker and per-screen controls. */
  readonly headControlPx: number;
  /** Width and height of the Save button. */
  readonly headSavePx: number;
  /** Width of the charts-per-screen select. */
  readonly perScreenWidthPx: number;
  /** Height of the band over each chart. */
  readonly bandPx: number;
  /** Padding above and below the Tune / What-if buttons. */
  readonly barPadYPx: number;
  /** Gap between those buttons, and from the screen edge. */
  readonly barGapPx: number;
  /** Line height of the shared legend. */
  readonly legendLinePx: number;
  /** Tallest an open Tune or What-if sheet grows before its rows scroll. */
  readonly sheetMaxPx: number;
  /** Height of the band at the top of a sheet. */
  readonly sheetBandPx: number;
}
