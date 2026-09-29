import {describe, expect, it} from 'vitest';
import {CHART_MIN_W, CHARTS_HIGH_OPTIONS, chartColumnsFit, chartGridLayout, chartGridStyle} from '../../src/hooks/chartGrid.js';

describe('chartColumnsFit', () => {
  it('as many columns as CHART_MIN_W allows, at most three', () => {
    expect(chartColumnsFit(CHART_MIN_W * 1.5)).toBe(1);
    expect(chartColumnsFit(CHART_MIN_W * 2)).toBe(2);
    expect(chartColumnsFit(CHART_MIN_W * 10)).toBe(3);
  });

  it('an unmeasured (zero-width) area gets one column', () => {
    expect(chartColumnsFit(0)).toBe(1);
  });
});

describe('chartGridLayout', () => {
  it('charts up to the chosen number stack one under the other', () => {
    expect(chartGridLayout(3, 1, 3)).toEqual({cols: 1, rows: 1});
    expect(chartGridLayout(3, 2, 3)).toEqual({cols: 1, rows: 2});
    expect(chartGridLayout(3, 3, 3)).toEqual({cols: 1, rows: 3});
  });

  it('more charts than the chosen number add columns', () => {
    expect(chartGridLayout(3, 4, 3)).toEqual({cols: 2, rows: 2});
    expect(chartGridLayout(2, 4, 3)).toEqual({cols: 2, rows: 2});
    expect(chartGridLayout(3, 7, 3)).toEqual({cols: 3, rows: 3});
  });

  it('columns stop at the most that fit, and the rows overflow', () => {
    expect(chartGridLayout(3, 10, 3)).toEqual({cols: 3, rows: 4});
    expect(chartGridLayout(2, 5, 1)).toEqual({cols: 1, rows: 5});
  });
});

describe('chartGridStyle', () => {
  it('rows up to the chosen number share the height', () => {
    expect(chartGridStyle(3, {cols: 2, rows: 2}, 600)).toEqual({
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
    });
  });

  it('overflowing rows are each 1/N of the height, so whole charts scroll into view', () => {
    expect(chartGridStyle(2, {cols: 1, rows: 5}, 600).gridTemplateRows).toBe('repeat(5, 300px)');
  });

  it('an unmeasured (zero-height) area shares whatever height it gets', () => {
    expect(chartGridStyle(2, {cols: 1, rows: 5}, 0).gridTemplateRows).toBe('repeat(5, minmax(0, 1fr))');
  });

  it('the offered numbers run 1 to 5', () => {
    expect(CHARTS_HIGH_OPTIONS.map(o => o.value)).toEqual([1, 2, 3, 4, 5]);
  });
});
