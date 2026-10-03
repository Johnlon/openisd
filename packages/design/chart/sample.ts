/** Lookups into a plotted series: linear interpolation, nearest peak or trough. */

/** The chart cursor's readout value: linear interpolation between the two already-plotted
 *  points straddling `x` (clamped to the series' own ends outside its range). `xs` must be
 *  sorted ascending and non-empty, and hold at least one point — the caller (which already
 *  built the series to draw the chart) guarantees this. */
export function interpolatedY(xs: readonly number[], ys: readonly number[], x: number): number {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let i = 1;
  while (i < xs.length && xs[i] < x) i++;
  const t = (x - xs[i - 1]) / (xs[i] - xs[i - 1]);
  return ys[i - 1] + t * (ys[i] - ys[i - 1]);
}

export type SnapDirection = 'left' | 'right';
export type SnapExtremum = 'max' | 'min';

/** The local peak (`max`) or trough (`min`) of a series nearest `f` by log distance, searching
 *  only the `direction` side of `f`; null when none qualifies. With `f` null the whole series is
 *  searched and distance is measured from its middle sample. Non-finite samples never qualify. */
export function snapFrequency(
  xs: readonly number[], ys: readonly number[], f: number | null, direction: SnapDirection, extremum: SnapExtremum,
): number | null {
  const candidates: number[] = [];
  for (let i = 1; i < ys.length - 1; i++) {
    if (!isFinite(ys[i])) continue;
    const peak = ys[i] > ys[i - 1] && ys[i] > ys[i + 1];
    const trough = ys[i] < ys[i - 1] && ys[i] < ys[i + 1];
    if (extremum === 'max' ? !peak : !trough) continue;
    if (f !== null) {
      if (direction === 'left' && xs[i] >= f) continue;
      if (direction === 'right' && xs[i] <= f) continue;
    }
    candidates.push(i);
  }
  if (!candidates.length) return null;
  const from = f ?? xs[Math.floor(xs.length / 2)];
  let best = candidates[0], bestD = Infinity;
  for (const i of candidates) {
    const d = Math.abs(Math.log10(xs[i]) - Math.log10(from));
    if (d < bestD) { bestD = d; best = i; }
  }
  return xs[best];
}
