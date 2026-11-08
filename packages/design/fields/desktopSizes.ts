/**
 * How big the desktop controls are, one set for every screen: the wizard, the Box tab, the dialogs.
 * The UI reads these as the CSS variables `cssVars()` names; it never picks a size of its own.
 * (John, 17 Oct 2026: "the buttons are tiny on desktop and completely inconsistent".)
 */
export class DesktopSizes {
  /** The height of every number box, pick list and ▲▼ button. */
  static readonly CONTROL_H_PX = 28;
  /** The width of one ▲ or ▼ button. */
  static readonly STEPPER_W_PX = 18;
  /** The label column of a field row, where the row does not choose its own. */
  static readonly LABEL_COL_PX = 150;
  /** The slot after every desktop field label, where its ⚠ shows: the only blank between the longest label of a
   *  group and the group's boxes, the same on every screen (John, QO466.c12, QO449.c16). */
  static readonly LABEL_SLOT_PX = 22;
  /** The CSS variable a field row reads for its label column: set per group to `labelColumnPx`. */
  static readonly LABEL_COLUMN_VAR = '--label-w';
  /** The CSS variable for the label column of a row whose group has not been measured yet: `LABEL_COL_PX`. */
  static readonly DEFAULT_LABEL_COLUMN_VAR = '--ctl-label-w';
  /** The smallest width of a footer button (Back, Next, Cancel, OK, Close). */
  static readonly FOOTER_BTN_W_PX = 84;
  /** The height of a footer button. */
  static readonly FOOTER_BTN_H_PX = 30;

  /** The sizes as CSS custom properties, for the document root. */
  static cssVars(): ReadonlyMap<string, string> {
    return new Map([
      ['--ctl-h', `${DesktopSizes.CONTROL_H_PX}px`],
      ['--ctl-stepper-w', `${DesktopSizes.STEPPER_W_PX}px`],
      [DesktopSizes.DEFAULT_LABEL_COLUMN_VAR, `${DesktopSizes.LABEL_COL_PX}px`],
      ['--ctl-label-slot', `${DesktopSizes.LABEL_SLOT_PX}px`],
      ['--ctl-btn-w', `${DesktopSizes.FOOTER_BTN_W_PX}px`],
      ['--ctl-btn-h', `${DesktopSizes.FOOTER_BTN_H_PX}px`],
    ]);
  }

  /** The label column of a group of field rows: its longest label's text, rounded up to whole pixels, and the
   *  slot after it. Every row in the group takes this one width, so their boxes share one left edge. */
  static labelColumnPx(textWidthsPx: readonly number[]): number {
    return Math.ceil(Math.max(0, ...textWidthsPx)) + DesktopSizes.LABEL_SLOT_PX;
  }

  private constructor() {}
}

/**
 * How wide a desktop pick list or text box in a field row is, as in 7.0.951's New project wizard:
 * the list fills the row's control column, whatever its longest choice. The UI reads `css`.
 */
export class PickWidth {
  /** Number of drivers, voice coil connection. */
  static readonly SHORT = new PickWidth(180);
  /** Box type. */
  static readonly MEDIUM = new PickWidth(240);
  /** Sealed and vented alignment. */
  static readonly LONG = new PickWidth(260);
  /** A name typed into a text box. */
  static readonly TEXT = new PickWidth(280);

  private constructor(readonly px: number) {}

  /** The width as a CSS length. */
  get css(): string { return `${this.px}px`; }
}
