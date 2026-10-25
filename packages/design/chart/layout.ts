/**
 * Where a chart's parts sit inside its panel, in CSS px: the plot's margins and the bands the title
 * and the tick labels take. The canvas draws from these, and the title's style (`.gpanel .gtitle`,
 * style.css) must end inside `titleBottomPx`; a browser spec checks that on every chart and phone size.
 *
 * 17 Oct 2026: the plot started 18 px down, inside the title's band, so the top level label (100)
 * was drawn over "SPL response".
 */
export class ChartLayout {
  constructor(
    /** The plot rectangle's distance from each side of the panel. */
    readonly margin: { readonly l: number; readonly r: number; readonly t: number; readonly b: number },
    /** The lowest point of the title box (`.gtitle`: top 4 px, one 12 px line). */
    readonly titleBottomPx: number,
    /** The tick labels' font size. */
    readonly tickFontPx: number,
    /** A level label's baseline sits this far below its tick. */
    readonly levelLabelBaselinePx: number,
    /** Clear space kept between the title and the top level label. */
    readonly gapPx: number,
  ) {}

  /** The highest point a level label can reach: a tick is drawn up to 1 px above the plot, and its label
   *  rises a full font height above its baseline. */
  get levelLabelTopPx(): number {
    return this.margin.t - 1 + this.levelLabelBaselinePx - this.tickFontPx;
  }

  /** The chart text's font stack: the page's own (`body`, style.css). A bare `Inter` has no generic fallback,
   *  so a browser without Inter drew the chart's text in whatever default face it chose, a serif on the test
   *  machines, and the choice differed from one run to the next. */
  static readonly FONT_FAMILY = '"Inter", system-ui, sans-serif';

  /** The canvas font shorthand for a size and weight, in this stack. */
  font(px: number, bold: boolean = false): string {
    return `${bold ? 'bold ' : ''}${px}px ${ChartLayout.FONT_FAMILY}`;
  }

  /** Where a frequency label is centred: on its grid line, moved in just far enough that the whole label
   *  stays inside the panel. The last label (20.0k) sits on the plot's right edge and is wider than the
   *  right margin, so centred on its line it was cut at the panel edge. */
  freqLabelCentreX(lineX: number, labelWidthPx: number, panelWidthPx: number): number {
    const half = labelWidthPx / 2;
    return Math.min(Math.max(lineX, half), panelWidthPx - half);
  }

  /** The least clear space between two neighbouring frequency labels. */
  static readonly MIN_FREQ_LABEL_GAP_PX = 6;

  /** Centres for a row of frequency labels, left to right: each kept inside the panel, and each moved left
   *  as far as needed to leave `MIN_FREQ_LABEL_GAP_PX` clear before the label to its right. On a phone the
   *  last label (20.0k) is pulled in from the edge and would otherwise nearly touch 10.0k. */
  freqLabelCentres(lineXs: readonly number[], widthsPx: readonly number[], panelWidthPx: number): number[] {
    const centres = lineXs.map((x, i) => this.freqLabelCentreX(x, widthsPx[i], panelWidthPx));
    for (let i = centres.length - 2; i >= 0; i--) {
      const limit = centres[i + 1] - widthsPx[i + 1] / 2 - ChartLayout.MIN_FREQ_LABEL_GAP_PX - widthsPx[i] / 2;
      centres[i] = Math.min(centres[i], limit);
    }
    return centres;
  }

  static readonly CHART = new ChartLayout({ l: 44, r: 10, t: 24, b: 20 }, 16, 9, 3, 1);
}
