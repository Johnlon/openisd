import {NumberField} from './field.js';

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
}
