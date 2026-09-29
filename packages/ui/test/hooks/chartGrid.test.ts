import {describe, expect, it} from 'vitest';
import {CHART_MIN_H, CHART_MIN_W, chartGridLayout, chartGridStyle} from '../../src/hooks/chartGrid.js';

const wide = CHART_MIN_W * 3;

describe('chartGridLayout', () => {
  it('one chart fills the area', () => {
    expect(chartGridLayout(1, wide, CHART_MIN_H)).toEqual({cols: 1, rows: 1});
  });

  it('stacks one under the other while every chart gets the minimum height', () => {
    expect(chartGridLayout(2, wide, CHART_MIN_H * 2)).toEqual({cols: 1, rows: 2});
    expect(chartGridLayout(3, wide, CHART_MIN_H * 3)).toEqual({cols: 1, rows: 3});
    expect(chartGridLayout(4, wide, CHART_MIN_H * 4)).toEqual({cols: 1, rows: 4});
  });

  it('four charts that do not fit stacked go 2x2', () => {
    expect(chartGridLayout(4, wide, CHART_MIN_H * 2)).toEqual({cols: 2, rows: 2});
  });

  it('three charts that do not fit stacked go two columns', () => {
    expect(chartGridLayout(3, wide, CHART_MIN_H * 2)).toEqual({cols: 2, rows: 2});
  });

  it('never more than three columns', () => {
    expect(chartGridLayout(9, CHART_MIN_W * 10, CHART_MIN_H)).toEqual({cols: 3, rows: 3});
  });

  it('a narrow area keeps fewer columns and lets the rows overflow', () => {
    expect(chartGridLayout(4, CHART_MIN_W * 1.5, CHART_MIN_H * 2)).toEqual({cols: 1, rows: 4});
  });

  it('an unmeasured (zero-size) area stacks', () => {
    expect(chartGridLayout(3, 0, 0)).toEqual({cols: 1, rows: 3});
  });
});

describe('chartGridStyle', () => {
  it('rows that fit share the height evenly', () => {
    expect(chartGridStyle({cols: 2, rows: 2}, CHART_MIN_H * 2)).toEqual({
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
    });
  });

  it('rows that do not fit keep the minimum height, so the area scrolls', () => {
    expect(chartGridStyle({cols: 1, rows: 4}, CHART_MIN_H * 2).gridTemplateRows)
      .toBe(`repeat(4, minmax(${CHART_MIN_H}px, 1fr))`);
  });

  it('a single row always fills the area, however short', () => {
    expect(chartGridStyle({cols: 1, rows: 1}, CHART_MIN_H / 2).gridTemplateRows).toBe('repeat(1, minmax(0, 1fr))');
  });
});
