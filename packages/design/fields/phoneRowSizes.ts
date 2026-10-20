import {SheetSizes} from './sheetSizes.js';

/**
 * How deep a phone field row is. Three sets: the tabs (Box, Driver, Signal, Advanced, Filters and the
 * other pages) keep 7.0.951's roomy rows, which John never asked to change; the Tune and What-if
 * sheets keep their tight rows so the chart above them stays in view (John, 18 Oct 2026); the driver
 * editor's many rows use the compact set, the label on the row's own line.
 * The UI reads these as the CSS variables `cssVars()` names; it never picks a size of its own.
 */
export class PhoneRowSizes {
  /** Tab rows: 48 px, 10 px above and below, as in 7.0.951. */
  static readonly TAB = new PhoneRowSizes(48, 10, 32, 16, 2, 0, 64, 30);
  /** Sheet rows: as tight as a finger allows. */
  static readonly SHEET = new PhoneRowSizes(SheetSizes.ROW_MIN_PX, 2, SheetSizes.TOUCH_MIN_PX, 14, 0, 0, 64, 30);
  /** Compact rows (John, 18 Oct 2026, "try a half way house"): 40 px rows, 36 px boxes, the label
   *  left on the same line in a fixed column, then box, ▲▼ (40 px wide), ⚠ and unit. */
  static readonly COMPACT = new PhoneRowSizes(40, 2, 36, 16, 0, 120, 40, 48);

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
    /** The width of the label column of an inline row (0: the label is above the box). */
    readonly labelColPx: number,
    /** The width of each ▲▼ button. */
    readonly stepperWidthPx: number,
    /** The width of the unit column. */
    readonly unitColPx: number,
  ) {}

  /** The sizes as CSS custom properties. */
  cssVars(): ReadonlyMap<string, string> {
    return new Map([
      ['--mob-row-min', `${this.rowMinPx}px`],
      ['--mob-row-pad-y', `${this.rowPadYPx}px`],
      ['--mob-input-h', `${this.inputMinPx}px`],
      ['--mob-label-lh', `${this.labelLinePx}px`],
      ['--mob-label-gap', `${this.labelGapPx}px`],
      ['--mob-label-w', `${this.labelColPx}px`],
      ['--mob-stepper-w', `${this.stepperWidthPx}px`],
      ['--mob-unit-w', `${this.unitColPx}px`],
      ['--mob-touch-min', `${SheetSizes.TOUCH_MIN_PX}px`],
    ]);
  }
}
