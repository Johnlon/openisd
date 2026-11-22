/** A linear axis's ticks: `step` apart, on multiples of `step`; `mag` is the step's decade. */
export interface LinearTicks {
  readonly ticks: number[];
  readonly step: number;
  readonly mag: number;
}

const MAX_TICKS = 1000;

/** Round ticks for `ymin … ymax` on a plot `ph` px tall, about one per 40 px. Counted, not stepped
 *  to an end margin, so any finite range terminates; a zero, reversed or non-finite range has
 *  none. */
export function linearTicks(ymin: number, ymax: number, ph: number): LinearTicks {
  const none: LinearTicks = { ticks: [], step: 1, mag: 1 };
  const span = ymax - ymin;
  if (!Number.isFinite(span) || !(span > 0)) return none;
  const step0 = span / Math.max(4, Math.round(ph / 40));
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const norm = step0 / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  if (!Number.isFinite(step) || !(step > 0)) return none;
  const k0 = Math.ceil(ymin / step - 1e-9);
  const count = Math.floor(ymax / step + 1e-9) - k0;
  if (!(count >= 0) || count > MAX_TICKS) return none;
  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) ticks.push(+((k0 + i) * step).toPrecision(12));
  return { ticks, step, mag };
}

/** 1, 2, 5 per decade inside `min … max`. A log axis has none below zero: log10(0) is -Infinity. */
export function logTicks(min: number, max: number): number[] {
  const t: number[] = [];
  if (!(min > 0) || !Number.isFinite(max)) return t;
  for (let d = Math.floor(Math.log10(min)); d <= Math.ceil(Math.log10(max)); d++)
    for (const mul of [1, 2, 5]) { const v = mul * Math.pow(10, d); if (v >= min && v <= max) t.push(v); }
  return t;
}
