import {describe, it, expect} from 'vitest';
import {ChartData} from '../../chart/chartData.js';
import {ChartLayout} from '../../chart/layout.js';
import {FrequencyAxis, LevelAxis} from '../../chart/axis.js';
import type {PlotData, Series} from '../../chart/types.js';

function plot(series: Series[], unit = 'dB'): PlotData {
  return {
    series, ymin: -40, ymax: 10, logy: false, unit, fmin: 10, fmax: 1000,
    freqAxis: new FrequencyAxis(10, 1000), levelAxis: new LevelAxis(-40, 10, false),
    rolloffs: [], layout: ChartLayout.CHART,
  };
}

describe('ChartData — a chart\'s plotted curves as a text table', () => {
  const sub: Series = {xs: [10, 20.5, 40], ys: [-12.34567, -3, 0.5], color: '#000', name: 'Sub'};
  const zeroDb: Series = {xs: [10, 20.5, 40], ys: [0, 0, 0], color: '#000', name: '0 dB', dash: true, reference: true};
  const legendOnly: Series = {xs: [], ys: [], color: '#000', name: 'Xmax limit', phantom: true};

  it('has frequency then one column per curve, units in the headers, values formatted', () => {
    const data = ChartData.of('Transfer function magnitude', plot([sub]));
    expect(data.headers).toEqual(['Frequency (Hz)', 'Sub (dB)']);
    expect(data.rows).toEqual([
      ['10.00', '-12.346'],
      ['20.50', '-3.000'],
      ['40.00', '0.500'],
    ]);
  });

  it('leaves out reference levels and legend-only entries but keeps a dashed data curve', () => {
    const unlimited: Series = {...sub, name: 'Unlimited', dash: true};
    const data = ChartData.of('SPL', plot([sub, unlimited, zeroDb, legendOnly]));
    expect(data.headers).toEqual(['Frequency (Hz)', 'Sub (dB)', 'Unlimited (dB)']);
  });

  it('a unitless chart has no unit in its headers', () => {
    expect(ChartData.of('X', plot([sub], '')).headers).toEqual(['Frequency (Hz)', 'Sub']);
  });

  it('curves on different frequencies share one sorted frequency column; a missing or non-finite value is blank', () => {
    const other: Series = {xs: [15, 40], ys: [Number.NaN, 2], color: '#000', name: 'Other'};
    const data = ChartData.of('SPL', plot([sub, other]));
    expect(data.rows).toEqual([
      ['10.00', '-12.346', ''],
      ['15.00', '', ''],
      ['20.50', '-3.000', ''],
      ['40.00', '0.500', '2.000'],
    ]);
  });

  it('CSV quotes a cell holding a comma or a quote, one line per row', () => {
    const named: Series = {...sub, name: 'Sub, "big"'};
    expect(ChartData.of('SPL', plot([named])).csv()).toBe(
      'Frequency (Hz),"Sub, ""big"" (dB)"\r\n10.00,-12.346\r\n20.50,-3.000\r\n40.00,0.500\r\n');
  });

  it('text is tab separated, for pasting into a spreadsheet', () => {
    expect(ChartData.of('SPL', plot([sub])).text()).toBe(
      'Frequency (Hz)\tSub (dB)\n10.00\t-12.346\n20.50\t-3.000\n40.00\t0.500\n');
  });

  it('the file is named after the project and the chart, with characters a file name cannot hold replaced', () => {
    const data = ChartData.of('Rear port - Air velocity', plot([sub]));
    expect(data.fileName('My sub')).toBe('My sub - Rear port - Air velocity.csv');
    expect(data.fileName('a/b:c')).toBe('a_b_c - Rear port - Air velocity.csv');
  });
});
