import {PhoneRowSizes} from './phoneRowSizes.js';

/**
 * How big the parts of the classic phone header are: the menu, cloud and save controls, the padding
 * around them and the project name (accepted mock, screens 1 and 27). The UI reads them as the CSS
 * variables `cssVars()` names; it never picks a size of its own.
 */
export class PhoneHeaderSizes {
  static readonly CLASSIC = new PhoneHeaderSizes(PhoneRowSizes.BUTTON_PX, 6, 14, 17, 2);

  private constructor(
    /** The menu, cloud and save controls: the one phone button size. */
    readonly controlPx: number,
    /** The padding above and below the controls. */
    readonly padYPx: number,
    /** The project name's text size. */
    readonly titleFontPx: number,
    /** The project name's line height. */
    readonly titleLinePx: number,
    /** The most lines the project name takes before it is cut with an ellipsis. */
    readonly titleLines: number,
  ) {}

  /** Bar height: the controls, the padding above and below, and the 1 px rule. */
  barHeightPx(): number { return this.controlPx + 2 * this.padYPx + 1; }

  /** The sizes as CSS custom properties. */
  cssVars(): ReadonlyMap<string, string> {
    return new Map([
      ['--mob-header-control', `${this.controlPx}px`],
      ['--mob-header-pad-y', `${this.padYPx}px`],
      ['--mob-header-title-px', `${this.titleFontPx}px`],
      ['--mob-header-title-lh', `${this.titleLinePx}px`],
      ['--mob-header-title-lines', `${this.titleLines}`],
    ]);
  }
}
