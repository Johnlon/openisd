/** The native `step` for a live number input showing `shown`: a power of ten one decade below
 *  |value|, so arrows move the value proportionally across scales. A power of ten (not
 *  value×0.1) is a clean multiple of 0, so the browser grid-snaps each step to a tidy decimal and
 *  stepping never stalls near min. Never finer than the decimals currently shown. `'any'` when
 *  `shown` is not a positive magnitude. */
export function spinnerStep(shown: string): string {
  const v = Math.abs(parseFloat(shown));
  if (!(v > 0)) return 'any';
  const decade = Math.floor(Math.log10(v)) - 1;
  const shownDp = (shown.split('.')[1] || '').length;
  // `Number('1e-4')` is the exact decimal; `Math.pow(10, -4)` is 0.00009999999999999999.
  return String(Number(`1e${Math.max(decade, -shownDp)}`));
}
