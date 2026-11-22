import {describe, expect, it} from 'vitest';
import {CHART_COLOR_ROWS, chartColorDefault} from '../../chart/index.js';

describe('CHART_COLOR_ROWS', () => {
  it('lists the nine colour rows in the phone order, with their reset words', () => {
    expect(CHART_COLOR_ROWS.map(r => [r.key, r.label, r.resetWord])).toEqual([
      ['zeroDb', '0 dB line', 'black'],
      ['minus3Db', '-3dB line', 'grey'],
      ['background', 'Background', 'white'],
      ['otherLines', 'Other lines', 'blue'],
      ['labels', 'Labels', 'black'],
      ['xmaxLimit', 'Xmax limit', 'red'],
      ['cursor', 'Cursor lines', 'green'],
      ['airSpeedLimit', 'Air speed limit', 'red'],
      ['selectedRange', 'Selected range', 'black'],
    ]);
  });
  it('gives the two newest rows the colours the charts draw', () => {
    expect(chartColorDefault('airSpeedLimit')).toBe('#ff6b6b');
    expect(chartColorDefault('selectedRange')).toBe('#000000');
  });
});
