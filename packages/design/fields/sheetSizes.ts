/**
 * How big the phone sheets' controls are. A finger needs at least 44 CSS px each way (John,
 * 17 Oct 2026: "buttons too small to be practical"), and a row holding a control is at least 48.
 * The UI reads these; it never picks a size of its own.
 */
export class SheetSizes {
  /** The smallest width and height of any tappable control in a Tune or What-if sheet. */
  static readonly TOUCH_MIN_PX = 44;
  /** The smallest height of a sheet row. */
  static readonly ROW_MIN_PX = 48;
  /** The pull-tab's height when a sheet is closed. */
  static readonly TAB_PX = SheetSizes.TOUCH_MIN_PX;

  private constructor() {}
}
