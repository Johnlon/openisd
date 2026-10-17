import {describe, expect, it} from 'vitest';
import {ChartLayout} from '../../chart/index.js';

describe('ChartLayout', () => {
  it('keeps the top level label below the title, with a gap', () => {
    const layout = ChartLayout.CHART;
    expect(layout.levelLabelTopPx).toBeGreaterThanOrEqual(layout.titleBottomPx + layout.gapPx);
  });

  it('places the top level label from the plot margin', () => {
    expect(new ChartLayout({ l: 0, r: 0, t: 30, b: 0 }, 0, 9, 3, 0).levelLabelTopPx).toBe(23);
  });
});
