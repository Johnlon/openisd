import {DesktopSizes} from './desktopSizes.js';
import {NumberField} from './field.js';
import {PhoneRowColumns} from './phoneRowSizes.js';

/**
 * The boxes the charts read as they show (QO534: "the editor and pr settings will use the [on-screen] values not hidden recalcs
 * always"). These are the ones the screens accent (QO532, John 11 Nov 2026: "not dimmed, just accentuated"). Every other box is
 * worked out from them, or is a datasheet figure the charts do not read.
 */
export class ChartInputs {
  /** A driver's circuit: Sd, Mms, Cms, Rms, Bl, Re and Le. */
  static readonly DRIVER: readonly NumberField[] = Object.freeze([
    NumberField.SD_M2, NumberField.MMS_KG, NumberField.CMS_M_PER_N, NumberField.RMS_KG_PER_S,
    NumberField.BL_TM, NumberField.RE_OHM, NumberField.LE_H,
  ]);

  /** A passive radiator's: Sd, Mms, Cms and Rms. */
  static readonly RADIATOR: readonly NumberField[] = Object.freeze([
    NumberField.PR_SD_CM2, NumberField.MMS_KG, NumberField.CMS_M_PER_N, NumberField.RMS_KG_PER_S,
  ]);

  /** The mark on such a box (QO532, John, 11 Nov 2026, on the blue dot picture: "do this"): a blue dot this wide, this far right of
   *  the label text, as in the picture he picked (8 CSS px; 16 pixels in that 2x picture). It is drawn over the row, so no box
   *  changes size, padding or font. */
  static readonly DOT_PX = 8;
  static readonly DOT_GAP_PX = 4;
  /** The least blank between the dot and whatever follows it (a warning mark or the box). */
  static readonly DOT_CLEAR_PX = 2;
  /** The span from the end of a label's text to the end of the dot's clear blank. */
  static readonly DOT_SPAN_PX = ChartInputs.DOT_GAP_PX + ChartInputs.DOT_PX + ChartInputs.DOT_CLEAR_PX;
  /** A warning mark at the end of the label column: the 18 px glyph and its 2 px margin (joined-fields.css). */
  static readonly WARNING_MARK_PX = 20;

  /** The width a label column adds for an accented label, past the blank it already leaves after the text, so the dot never runs
   *  into the warning mark or the box. */
  static dotRoomPx(blankAfterTextPx: number): number {
    return Math.max(0, ChartInputs.DOT_SPAN_PX - blankAfterTextPx);
  }

  /** Desktop: the column leaves the warning slot after the longest label, and a warning mark can take all but its first 2 px. */
  static readonly DESKTOP_DOT_ROOM_PX = ChartInputs.dotRoomPx(DesktopSizes.LABEL_SLOT_PX - ChartInputs.WARNING_MARK_PX);

  /** Phone: the label keeps a margin for its warning mark when it has one, and the column adds its own padding after the label. */
  static phoneDotRoomPx(labelMarginRightPx: number): number {
    const warning = labelMarginRightPx >= ChartInputs.WARNING_MARK_PX ? ChartInputs.WARNING_MARK_PX : 0;
    return ChartInputs.dotRoomPx(labelMarginRightPx - warning + PhoneRowColumns.LABEL_PAD_PX);
  }

  /** The app's accent blue (`--acc`). */
  static readonly DOT_COLOUR = '#1868d1';
  /** The same colour as the browser reports it. */
  static readonly DOT_COLOUR_RGB = 'rgb(24, 104, 209)';

  /** The CSS variables an accented field row reads to draw the dot. */
  static dotCssVars(): ReadonlyMap<string, string> {
    return new Map([
      ['--engine-dot-size', `${ChartInputs.DOT_PX}px`],
      ['--engine-dot-gap', `${ChartInputs.DOT_GAP_PX}px`],
      ['--engine-dot-colour', ChartInputs.DOT_COLOUR],
      ['--engine-dot-room', `${ChartInputs.DESKTOP_DOT_ROOM_PX}px`],
    ]);
  }
}
