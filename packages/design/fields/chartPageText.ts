import type {BoxType} from '../engine/index.js';
import {CHART_HELP} from './chartHelpText.js';
import {PhoneHelpSection, type PhoneHelpRow} from './phoneText.js';
import {SheetField} from './sheetField.js';
import type {SheetMode} from './sheetMode.js';

/** What a sheet row is, one line each (the accepted classic mock's words). */
const SHEET_ROW_TEXT: ReadonlyMap<SheetField, string> = new Map([
  [SheetField.BOX_VOLUME, 'the box volume. A larger box plays lower bass.'],
  [SheetField.REAR_VOLUME, 'the space inside the rear chamber.'],
  [SheetField.FRONT_VOLUME, 'the space inside the front chamber.'],
  [SheetField.TUNING, 'the frequency the vent is tuned to.'],
  [SheetField.FRONT_TUNING, 'the frequency the front chamber\'s vent is tuned to.'],
  [SheetField.REAR_TUNING, 'the frequency the rear chamber\'s vent is tuned to.'],
  [SheetField.PORT_AREA, 'the vent\'s cross-section area. Tap to change the vent itself.'],
  [SheetField.REAR_PORT_AREA, 'the rear vent\'s cross-section area.'],
  [SheetField.FRONT_PORT_AREA, 'the front vent\'s cross-section area.'],
  [SheetField.INTRA_PORT_AREA, 'the cross-section area of the vent between the two chambers.'],
  [SheetField.PR_ADDED_MASS, 'the mass added to the passive radiator to lower its tuning.'],
  [SheetField.PR_COUNT, 'how many passive radiators the box has.'],
  [SheetField.INPUT_POWER, 'the power the amplifier sends to the driver.'],
  [SheetField.DRIVER_FS, 'the frequency at which the driver vibrates most freely, out of a box. Lower Fs can reach lower bass.'],
  [SheetField.DRIVER_QES, 'how sharply the driver resonates, from its motor alone. A stronger motor gives a lower value.'],
  [SheetField.DRIVER_QMS, 'how sharply the driver resonates, from its suspension alone.'],
  [SheetField.DRIVER_VAS, 'the volume of air that is as easy to compress as the suspension is to stretch. A larger Vas needs a larger box.'],
  [SheetField.DRIVER_COUNT, 'the number of drivers in the box.'],
]);

const TUNE_INTRO = 'Changes the design itself while you watch the chart. Auto Y fits the chart\'s height to the curve.';
const WHAT_IF_INTRO = 'Tries other values on the chart without changing the design. Reset returns to the design\'s values. Auto Y fits the chart\'s height to the curve.';

/** The words on the phone Graph page: what each chart band's ? and each sheet band's ? opens. */
export class ChartPageHelp {
  /** The help of every chart, in chart-menu order. */
  static readonly CHARTS: readonly PhoneHelpSection[] = Object.values(CHART_HELP);

  /** The help of a chart's band, by the chart's name; null for a name that is no chart. */
  static forChart(chartName: string): PhoneHelpSection | null {
    return ChartPageHelp.CHARTS.find(section => section.title === chartName) ?? null;
  }

  /** The help of a sheet's band: what the sheet is for, then one line per row it shows for this box. */
  static forSheet(mode: SheetMode, boxType: BoxType): PhoneHelpSection {
    const rows: PhoneHelpRow[] = [];
    for (const line of mode.lines(boxType)) for (const field of line) {
      const text = SHEET_ROW_TEXT.get(field);
      if (text !== undefined) rows.push({label: mode.labelOf(field), text});
    }
    return new PhoneHelpSection(mode.label, mode.edits === 'project' ? TUNE_INTRO : WHAT_IF_INTRO, rows);
  }
}
