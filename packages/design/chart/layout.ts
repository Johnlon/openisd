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

  static readonly CHART = new ChartLayout({ l: 44, r: 10, t: 24, b: 20 }, 16, 9, 3, 1);
}
