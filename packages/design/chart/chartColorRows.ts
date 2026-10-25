import {DEFAULT_REFERENCE_LINE_COLORS, DEFAULT_SELECTED_RANGE_COLOR} from './series.js';

/** The chart colours the user can pick in Options, Plot Window. */
export type ChartColorKey = 'zeroDb' | 'minus3Db' | 'background' | 'otherLines' | 'labels' | 'xmaxLimit' | 'cursor' | 'airSpeedLimit' | 'selectedRange';

export interface ChartColorRow {
  readonly key: ChartColorKey;
  readonly label: string;
  /** The colour's name in the reset button's tooltip ("Back to red"). */
  readonly resetWord: string;
  /** The colour drawn when the user has chosen none. */
  readonly defaultColor: string;
  /** What the row colours, as the desktop dialog's tooltip; absent where the label says it all. */
  readonly hint?: string;
}

/** The one list of colour rows, in the order of the phone Options page; the desktop dialog shows the same rows. */
export const CHART_COLOR_ROWS: readonly ChartColorRow[] = [
  {key: 'zeroDb', label: '0 dB line', resetWord: 'black', defaultColor: DEFAULT_REFERENCE_LINE_COLORS.zeroDb, hint: 'Colour of the 0 dB line on the transfer function, port gain and filter charts.'},
  {key: 'minus3Db', label: '-3dB line', resetWord: 'grey', defaultColor: DEFAULT_REFERENCE_LINE_COLORS.minus3Db, hint: 'Colour of the -3 dB line on the transfer function and port gain charts.'},
  {key: 'background', label: 'Background', resetWord: 'white', defaultColor: '#ffffff'},
  {key: 'otherLines', label: 'Other lines', resetWord: 'blue', defaultColor: '#3a7bd5'},
  {key: 'labels', label: 'Labels', resetWord: 'black', defaultColor: '#000000'},
  {key: 'xmaxLimit', label: 'Xmax limit', resetWord: 'red', defaultColor: '#ff0000'},
  {key: 'cursor', label: 'Cursor lines', resetWord: 'green', defaultColor: '#2e8b57'},
  {key: 'airSpeedLimit', label: 'Air speed limit', resetWord: 'red', defaultColor: DEFAULT_REFERENCE_LINE_COLORS.airSpeedLimit},
  {key: 'selectedRange', label: 'Selected range', resetWord: 'black', defaultColor: DEFAULT_SELECTED_RANGE_COLOR},
];

/** The colour shown for a row the user has not changed. */
export function chartColorDefault(key: ChartColorKey): string {
  const row = CHART_COLOR_ROWS.find(r => r.key === key);
  return row ? row.defaultColor : '#000000';
}
