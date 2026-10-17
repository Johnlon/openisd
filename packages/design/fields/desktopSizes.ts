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
  /** The smallest width of a footer button (Back, Next, Cancel, OK, Close). */
  static readonly FOOTER_BTN_W_PX = 84;
  /** The height of a footer button. */
  static readonly FOOTER_BTN_H_PX = 30;

  /** The sizes as CSS custom properties, for the document root. */
  static cssVars(): ReadonlyMap<string, string> {
    return new Map([
      ['--ctl-h', `${DesktopSizes.CONTROL_H_PX}px`],
      ['--ctl-stepper-w', `${DesktopSizes.STEPPER_W_PX}px`],
      ['--ctl-label-w', `${DesktopSizes.LABEL_COL_PX}px`],
      ['--ctl-btn-w', `${DesktopSizes.FOOTER_BTN_W_PX}px`],
      ['--ctl-btn-h', `${DesktopSizes.FOOTER_BTN_H_PX}px`],
    ]);
  }

  private constructor() {}
}
