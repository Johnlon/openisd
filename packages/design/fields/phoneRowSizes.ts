import {SheetSizes} from './sheetSizes.js';

/**
 * How deep a phone field row is. Three sets: the tabs (Box, Driver, Signal, Advanced, Filters and the
 * other pages) keep 7.0.951's roomy rows, which John never asked to change; the Tune and What-if
 * sheets keep their tight rows so the chart above them stays in view (John, 18 Oct 2026); the driver
 * editor uses the classic rows, as the tab pages do.
 * The UI reads these as the CSS variables `cssVars()` names; it never picks a size of its own.
 */
export class PhoneRowSizes {
  /** The one phone button's height, app-wide (John, 20 Oct 2026, QO291.c36: one button size). */
  static readonly BUTTON_PX = 44;
  /** Tab rows: 48 px, 10 px above and below, as in 7.0.951. */
  static readonly TAB = new PhoneRowSizes(48, 10, 32, 16, 2, 0, 64, 30);
  /** Classic rows (the accepted classic phone design): 40 px, 34 px boxes. Replaces TAB for tab pages, and
   *  the Tune and What-if sheets use it too (one row size across the app, John, 20 Oct 2026).
   *  The widths across the row are PhoneRowColumns; these last three match PhoneRowColumns.STANDARD. */
  static readonly CLASSIC = new PhoneRowSizes(40, 3, 34, 16, 0, 82, 45, 40);
  /** Sheet rows: as tight as a finger allows. */
  static readonly SHEET = new PhoneRowSizes(SheetSizes.ROW_MIN_PX, 2, SheetSizes.TOUCH_MIN_PX, 14, 0, 0, 64, 30);

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
      ['--mob-button-h', `${PhoneRowSizes.BUTTON_PX}px`],
    ]);
  }
}

/** The widths across a classic phone row: label, ▲▼ area, unit chip, and the text gutter in the box. */
export class PhoneRowColumns {
  /** Compound labels such as mm/N and 1000/K need room for their text and chip padding. */
  static readonly WIDE_CHIP_PX = 60;
  static readonly WARNING_PX = 26;
  static readonly MODEL_CUE_PX = 24;
  static readonly CONTROL_GAP_PX = 8;

  static chipIsWide(label: string): boolean { return label.length > 3; }

  static readonly STANDARD = new PhoneRowColumns(82, 90, 40, 16);
  /** The Advanced page's air rows: wide enough for "Temperature" on one line, narrow enough to leave room for a pressure in Pa. */
  static readonly MEDIUM_LABEL = new PhoneRowColumns(96, 90, 40, 16);
  /** The driver editor's General tab, whose labels are longer. */
  static readonly WIDE_LABEL = new PhoneRowColumns(128, 90, 40, 16);

  private constructor(
    /** The label column. */
    readonly labelPx: number,
    /** The ▲▼ area; readouts and selects leave it empty. */
    readonly stepperPx: number,
    /** The smallest width of a unit chip. */
    readonly chipMinPx: number,
    /** The gap between the box's left edge and its text. */
    readonly textGutterPx: number,
  ) {}

  /** The widths as CSS custom properties. */
  cssVars(): ReadonlyMap<string, string> {
    return new Map([
      ['--mob-col-label', `${this.labelPx}px`],
      ['--mob-col-stepper', `${this.stepperPx}px`],
      ['--mob-col-chip-min', `${this.chipMinPx}px`],
      ['--mob-col-chip-wide', `${PhoneRowColumns.WIDE_CHIP_PX}px`],
      ['--mob-col-dq', `${PhoneRowColumns.WARNING_PX}px`],
      ['--mob-col-model', `${PhoneRowColumns.MODEL_CUE_PX}px`],
      ['--mob-col-gap', `${PhoneRowColumns.CONTROL_GAP_PX}px`],
      ['--mob-col-gutter', `${this.textGutterPx}px`],
    ]);
  }
}
