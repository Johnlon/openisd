import {SheetSizes} from './sheetSizes.js';

/**
 * How deep a phone field row is. Two sets: the tabs (Box, Driver, Signal, Advanced, Filters and the
 * other pages) keep 7.0.951's roomy rows, which John never asked to change; the Tune and What-if
 * sheets keep their tight rows so the chart above them stays in view (John, 18 Oct 2026).
 * The UI reads these as the CSS variables `cssVars()` names; it never picks a size of its own.
 */
export class PhoneRowSizes {
  /** Tab rows: 48 px, 10 px above and below, as in 7.0.951. */
  static readonly TAB = new PhoneRowSizes(48, 10, 32, 16, 2);
  /** Sheet rows: as tight as a finger allows. */
  static readonly SHEET = new PhoneRowSizes(SheetSizes.ROW_MIN_PX, 2, SheetSizes.TOUCH_MIN_PX, 14, 0);

  private constructor(
    /** The smallest height of a row. */
    readonly rowMinPx: number,
    /** The padding above and below a row's content. */
    readonly rowPadYPx: number,
    /** The smallest height of a row's number box or pick list. */
    readonly inputMinPx: number,
    /** The line height of a row's label. */
    readonly labelLinePx: number,
    /** The gap between a row's label and its control. */
    readonly labelGapPx: number,
  ) {}

  /** The sizes as CSS custom properties. */
  cssVars(): ReadonlyMap<string, string> {
    return new Map([
      ['--mob-row-min', `${this.rowMinPx}px`],
      ['--mob-row-pad-y', `${this.rowPadYPx}px`],
      ['--mob-input-h', `${this.inputMinPx}px`],
      ['--mob-label-lh', `${this.labelLinePx}px`],
      ['--mob-label-gap', `${this.labelGapPx}px`],
    ]);
  }
}
