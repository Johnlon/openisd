/**
 * The line a chart that cannot be drawn shows before its reasons: which input to change (John, 19 Nov 2026,
 * QO955.c3/c4: "if a chart cannot be drawn then the chart should show the reason message, and the related fields
 * also, this is particularly important on the mobile where we can't see the chart and fields at the same time";
 * he chose "chart shows the reason AND each field causing it shows it too (desktop and phone)").
 *
 * An issue names its field by its quantity key (`length_m`, `Vb_m3`, `Fs_hz`); this turns each key into the
 * label the field carries on screen (the field registry's own label), and on the phone adds the tab it is on.
 * A key no field answers to (a sweep that produced no numbers) names nothing, and the line then says so
 * instead of pointing at "the listed inputs".
 */
import type {DriverError} from '../engine/index.js';
import {NumberField} from './field.js';

/** The phone tab, or the options dialog, a field lives on. */
export type FieldPlace = 'Box' | 'Driver' | 'Signal' | 'Filters' | 'Options';

interface Place {
  readonly field: NumberField;
  readonly place: FieldPlace;
}

const PLACES: ReadonlyMap<string, Place> = new Map<string, Place>([
  ['Re_terminal_ohm', {field: NumberField.RE_OHM, place: 'Driver'}],
  ['BL_terminal_Tm', {field: NumberField.BL_TM, place: 'Driver'}],
  ['Vb_m3', {field: NumberField.BOX_VB_L, place: 'Box'}],
  ['volume_m3', {field: NumberField.BOX_VB_L, place: 'Box'}],
  ['Vb', {field: NumberField.BOX_VB_L, place: 'Box'}],
  ['Vf', {field: NumberField.BOX_VF_L, place: 'Box'}],
  ['length_m', {field: NumberField.VENT_L_CM, place: 'Box'}],
  ['area_m2', {field: NumberField.VENT_CROSSAREA_M2, place: 'Box'}],
  ['count', {field: NumberField.VENT_COUNT, place: 'Box'}],
  ['tuning_goal_hz', {field: NumberField.BOX_FB_HZ, place: 'Box'}],
  ['Fb', {field: NumberField.BOX_FB_HZ, place: 'Box'}],
  ['Fr', {field: NumberField.BOX_FRC_HZ, place: 'Box'}],
  ['Ff', {field: NumberField.BOX_FFC_HZ, place: 'Box'}],
  ['addedMass_kg', {field: NumberField.PR_MADD_G, place: 'Box'}],
  ['prMadd', {field: NumberField.PR_MADD_G, place: 'Box'}],
  ['prNum', {field: NumberField.PR_NUM, place: 'Box'}],
  ['prSd_m2', {field: NumberField.PR_SD_CM2, place: 'Box'}],
  ['prSd', {field: NumberField.PR_SD_CM2, place: 'Box'}],
  ['Qlr', {field: NumberField.LOSS_QL, place: 'Box'}],
  ['Qlf', {field: NumberField.LOSS_QL, place: 'Box'}],
  ['Qar', {field: NumberField.LOSS_QA, place: 'Box'}],
  ['Qaf', {field: NumberField.LOSS_QA, place: 'Box'}],
  ['Qpr', {field: NumberField.LOSS_QP, place: 'Box'}],
  ['Qpf', {field: NumberField.LOSS_QP, place: 'Box'}],
  ['Qiclfr', {field: NumberField.LOSS_QICL, place: 'Box'}],
  ['nDrivers', {field: NumberField.DRIVER_NDRIVERS, place: 'Box'}],
  ['power_W', {field: NumberField.SIGNAL_PIN_W, place: 'Signal'}],
  ['voltage_V', {field: NumberField.SIGNAL_DRIVEV_V, place: 'Signal'}],
  ['eg', {field: NumberField.SIGNAL_DRIVEV_V, place: 'Signal'}],
  ['Rs', {field: NumberField.SIGNAL_RS_OHM, place: 'Signal'}],
  ['Rs_ohm', {field: NumberField.SIGNAL_RS_OHM, place: 'Signal'}],
  ['fmin', {field: NumberField.PLOT_FMIN_HZ, place: 'Options'}],
  ['fmax', {field: NumberField.PLOT_FMAX_HZ, place: 'Options'}],
  ['tempK', {field: NumberField.ADV_TEMP_K, place: 'Options'}],
  ['humidityPct', {field: NumberField.ADV_HUMIDITY_PCT, place: 'Options'}],
  ['pressurePa', {field: NumberField.ADV_PRESSURE_KPA, place: 'Options'}],
  ['c', {field: NumberField.ADV_SOUNDVELOCITY_M_PER_S, place: 'Options'}],
  ['c_m_per_s', {field: NumberField.ADV_SOUNDVELOCITY_M_PER_S, place: 'Options'}],
  ['rho', {field: NumberField.ADV_AIRDENSITY_KG_PER_M3, place: 'Options'}],
  ['roo_kg_per_m3', {field: NumberField.ADV_AIRDENSITY_KG_PER_M3, place: 'Options'}],
]);

/** The driver fields a driver issue can name sit on the Driver tab; their key is the field's own record key. */
function placeOf(key: string): Place | undefined {
  const known = PLACES.get(key);
  if (known !== undefined) return known;
  const driverField = NumberField.named(key);
  return driverField === undefined ? undefined : {field: driverField, place: 'Driver'};
}

/** How a field is named in the line: its label, and on the phone its tab as well. */
function nameOf(place: Place, onPhone: boolean): string {
  return onPhone ? `${place.field.label} (${place.place === 'Options' ? 'Options' : `${place.place} tab`})` : place.field.label;
}

/**
 * The fix line for ordinary field issues. `keys` are the blocking issues' field keys; the same field named
 * twice is named once. With no field to name it says only to change an input, never "the listed inputs".
 */
export function blockedChartFixLine(keys: readonly string[], onPhone: boolean): string {
  const names = [...new Set(keys.flatMap(key => {
    const place = placeOf(key);
    return place === undefined ? [] : [nameOf(place, onPhone)];
  }))];
  if (names.length === 0) return 'Change an input to restore this chart.';
  return `Fix: ${names.join(', ')}`;
}

/** The repair and driver summary precede the individual field notes on both skins. */
export function blockedChartText(errors: readonly DriverError[], onPhone: boolean) {
  const driver = errors.find(error => error.chartFix !== undefined)?.chartFix;
  const other = errors.filter(error => error.chartFix === undefined);
  const fieldFix = blockedChartFixLine(other.map(error => error.field), onPhone);
  return {
    fix: driver === undefined ? fieldFix :
      [onPhone ? driver.phone : driver.desktop, ...(other.length === 0 ? [] : [fieldFix])].join(' '),
    canEditDriverParameters: driver !== undefined,
    summary: driver?.summary,
    details: errors.map(error => ({field: error.field, text: error.message})),
  };
}
