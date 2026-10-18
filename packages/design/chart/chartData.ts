import {ReadoutFormat} from '../fields/index.js';
import type {PlotData} from './types.js';

/** Characters a file name cannot hold on Windows, macOS or Linux. */
const NOT_IN_FILE_NAME = /[\\/:*?"<>|]+/g;

/**
 * A chart's plotted curves as a text table: frequency, then one column per curve, units in the
 * headers. Reference levels (0 dB, F3, a limit) and legend-only entries are not curves and are
 * left out. Curves sampled at different frequencies share one sorted frequency column; a curve
 * with no finite value at a frequency has a blank cell there.
 */
export class ChartData {
  private constructor(
    readonly chartName: string,
    readonly headers: readonly string[],
    readonly rows: readonly (readonly string[])[],
  ) {}

  static of(chartName: string, plot: PlotData): ChartData {
    const curves = plot.series.filter(s => !s.reference && !s.phantom);
    const unit = plot.unit === '' ? '' : ` (${plot.unit})`;
    const headers = ['Frequency (Hz)', ...curves.map(s => s.name + unit)];
    const byCurve = curves.map(s => new Map(s.xs.map((x, i) => [x, s.ys[i]])));
    const frequencies = [...new Set(curves.flatMap(s => s.xs))].sort((a, b) => a - b);
    const rows = frequencies.map(f => [
      ReadoutFormat.CURSOR_FREQUENCY_HZ.text(f, ''),
      ...byCurve.map(values => {
        const y = values.get(f);
        return y !== undefined && Number.isFinite(y) ? ReadoutFormat.CURSOR_LEVEL.text(y, '') : '';
      }),
    ]);
    return new ChartData(chartName, headers, rows);
  }

  /** Comma separated, a cell with a comma, quote or line break quoted, CRLF line ends. */
  csv(): string {
    const cell = (c: string): string => /[",\r\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c;
    return [this.headers, ...this.rows].map(r => r.map(cell).join(',') + '\r\n').join('');
  }

  /** Tab separated, for pasting into a spreadsheet. */
  text(): string {
    return [this.headers, ...this.rows].map(r => r.join('\t') + '\n').join('');
  }

  /** "<project> - <chart>.csv". */
  fileName(projectName: string): string {
    return `${projectName} - ${this.chartName}.csv`.replace(NOT_IN_FILE_NAME, '_');
  }
}
