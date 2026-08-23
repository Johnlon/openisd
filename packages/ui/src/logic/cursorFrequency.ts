/**
 * The chart cursor's frequency arithmetic.
 *
 * Vue-free and state-free: every function here takes the numbers it needs and returns a
 * number. Writing the result to `presentationState` is the caller's job, which is what lets
 * the keyboard, wheel, press-and-hold and typed-entry paths share one definition of "what is
 * the next frequency" instead of each carrying its own copy.
 *
 * Frequency is stepped MULTIPLICATIVELY because the chart's x-axis is logarithmic: a fixed
 * ratio moves the cursor the same visible distance at 20 Hz as at 20 kHz, where a fixed
 * increment would crawl at the top of the range and jump at the bottom.
 */

/** One nudge of the cursor. `dir` is +1 up the frequency axis, -1 down. `factor` is the ratio
 *  per step (a plain nudge and a shift-modified nudge pass different ratios). `current` is
 *  null when nothing is pinned yet, in which case the step starts from the midpoint of the
 *  visible axis — the GEOMETRIC mean, since the axis is logarithmic. */
export function steppedFrequency(
  { current, dir, factor, fmin, fmax }:
  { current: number | null; dir: number; factor: number; fmin: number; fmax: number },
): number {
  const from = current ?? Math.sqrt(fmin * fmax);
  const stepped = dir > 0 ? from * factor : from / factor;
  return Math.max(fmin, Math.min(fmax, stepped));
}

/** A frequency the user typed, held to the visible axis. Returns null for anything that is
 *  not a frequency this axis can show — a log axis has no zero and no negative side, and a
 *  half-typed entry parses to NaN. Null means "unpin the cursor", not "use a default". */
export function clampedFrequency(value: number, fmin: number, fmax: number): number | null {
  if (!isFinite(value) || value <= 0) return null;
  return Math.max(fmin, Math.min(fmax, value));
}

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
