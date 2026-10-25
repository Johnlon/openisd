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

  it('title row height accommodates the title, data button, and Auto Y switch clear of tick labels', () => {
    const layout = ChartLayout.CHART;
    // Top tick label starts at levelLabelTopPx (17px). The title row ends inside titleBottomPx (16px).
    expect(layout.titleBottomPx).toBeLessThanOrEqual(layout.levelLabelTopPx - layout.gapPx);
  });
});

describe('ChartLayout chart text font', () => {
  it('names a generic family, so a missing Inter never falls to the browser default face', () => {
    expect(ChartLayout.CHART.font(9)).toBe('9px "Inter", system-ui, sans-serif');
    expect(ChartLayout.CHART.font(9, true)).toBe('bold 9px "Inter", system-ui, sans-serif');
  });
});

describe('ChartLayout frequency label placement', () => {
  const layout = ChartLayout.CHART;

  it('keeps the last label (20.0k, centred on the plot edge) inside the panel', () => {
    const width = 25, canvasW = 800, plotRight = canvasW - layout.margin.r;
    const x = layout.freqLabelCentreX(plotRight, width, canvasW);
    expect(x + width / 2).toBeLessThanOrEqual(canvasW);
  });

  it('leaves a label that already fits where its grid line is', () => {
    expect(layout.freqLabelCentreX(400, 25, 800)).toBe(400);
  });

  it('keeps a label at the left edge inside the panel', () => {
    expect(layout.freqLabelCentreX(2, 25, 800) - 12.5).toBeGreaterThanOrEqual(0);
  });

  it('keeps a clear gap between neighbouring labels at phone width (10.0k, 20.0k)', () => {
    const canvasW = 374, plotW = canvasW - layout.margin.l - layout.margin.r;
    const widths = [25, 25];
    const lineXs = [layout.margin.l + plotW * 0.9, layout.margin.l + plotW];
    const [a, b] = layout.freqLabelCentres(lineXs, widths, canvasW);
    const gap = (b - widths[1] / 2) - (a + widths[0] / 2);
    expect(gap).toBeGreaterThanOrEqual(ChartLayout.MIN_FREQ_LABEL_GAP_PX);
    expect(b + widths[1] / 2).toBeLessThanOrEqual(canvasW);
  });

  it('leaves well-spaced labels on their grid lines', () => {
    expect(layout.freqLabelCentres([100, 300, 500], [25, 25, 25], 800)).toEqual([100, 300, 500]);
  });
});
