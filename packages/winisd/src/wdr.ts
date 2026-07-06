/**
 * WinISD .wdr serialisation + ParState provenance — the fresh-authored export path.
 *
 * File-format concerns live here, not in @openisd/engine (ARCHITECTURE.md AD-6). This is
 * the raw-driver exporter used by Driver.toWdr when there is no carried WDR to echo (a
 * driver authored in-app rather than loaded from a file). The physics (deriveDriver) is
 * imported from the engine; nothing here belongs in it. Import/parse is the ADT's job —
 * Driver.fromWdr — so there is no parser here.
 */

import { deriveDriver } from '@openisd/engine';
import type { DriverRaw, Driver } from '@openisd/engine';

export function toWdr(raw: DriverRaw): string {
  const { value: d } = deriveDriver(raw);
  if (!d) return '';
  const Sd  = d.Sd, Vd = Sd * (d.Xmax || 0), Dd = 2 * Math.sqrt(Sd / Math.PI);
  const g   = (x: number | null | undefined, p = 6): string | number => (x == null || !isFinite(x)) ? '' : (+x.toPrecision(p));
  const brand = raw.brand || '', model = raw.model || '';
  const ParState = parstate(raw, d);
  const L = [
    '[Driver]', 'Brand=' + brand, 'Model=' + model, 'Manufacturer=',
    'ProvidedBy=OpenISD', 'Comment=' + (raw.comment || ''), 'DateAdded=', 'DateModified=',
    'Qts=' + g(d.Qts), 'Znom=' + g(d.Z || d.Re),
    'Fs=' + g(d.Fs), 'Pe=' + g(d.Pe), 'Re=' + g(d.Re), 'Le=' + g(d.Le),
    'BL=' + g(d.Bl), 'Xmax=' + g(d.Xmax),
    'Cms=' + g(d.Cms), 'Qms=' + g(d.Qms), 'Qes=' + g(d.Qes), 'Rms=' + g(d.Rms),
    'Mms=' + g(d.Mms), 'Sd=' + g(d.Sd), 'Vas=' + g(d.Vas),
    'Vd=' + g(Vd), 'Dd=' + g(Dd), 'numVC=1', 'VCCon=2', 'ParState=' + ParState, '',
  ];
  return L.join('\n');
}

/**
 * Build WinISD's 49-char ParState string for a fresh-authored exported driver: per-field
 * edit state in WinISD's internal field order — E (a value the human ENTERED), C (a value
 * the app COMPUTED), N (absent). Positions are probe-confirmed against real WinISD files
 * (drivers/sample/; see scraper_lib._parstate).
 *
 * This is the FRESH path only: the driver was authored in-app, so `raw` (what the human
 * supplied) vs `d` (what deriveDriver produced) unambiguously gives E vs C — there is no
 * loaded file to misread. A driver LOADED from a .wdr instead replays its own ParState
 * through the Driver ADT (Driver.fromWdr → cell().state → Driver's #buildParState).
 */
export function parstate(raw: DriverRaw, d: Driver): string {
  const s = new Array<string>(49).fill('N');
  const num = (v: number | null | undefined): boolean => v != null && isFinite(v);
  // E if supplied in raw; else C if the app derived a value; else N.
  const mark = (pos: number, rawv: number | undefined, dv: number | undefined): void => {
    s[pos] = num(rawv) ? 'E' : (num(dv) ? 'C' : 'N');
  };

  // Fixed positions (probe-confirmed)
  s[23] = 'E';                                       // numVC (WinISD defaults to 1)
  for (const p of [32, 33, 34, 35, 36, 37]) s[p] = 'C'; // gamma, EBP, Rme, Mpow, Mcost, Gloss
  s[47] = 'C'; s[48] = 'C';                          // c (speed of sound), roo (air density)
  s[3]  = 'C';                                       // SPL — WinISD computes it (OpenISD supplies none)

  s[0] = num(raw.Z) ? 'E' : 'C';                     // Znom: entered, else defaulted from Re
  mark(1,  raw.Fs,   d.Fs);
  mark(2,  raw.Pe,   d.Pe);                          // Pe/Le/Xmax pass through: E if supplied, else N
  mark(4,  raw.Re,   d.Re);
  mark(5,  raw.Le,   d.Le);
  if (num(d.Bl))  s[8]  = 'C';                       // Bl always derived → C (never in raw)
  mark(9,  raw.Xmax, d.Xmax);
  if (num(d.Cms)) s[11] = 'C';                       // Cms always derived → C
  mark(12, raw.Qms,  d.Qms);                         // Q trio: E if entered, C if the derived one
  mark(13, raw.Qes,  d.Qes);
  mark(14, raw.Qts,  d.Qts);
  if (num(d.Rms)) s[15] = 'C';                       // Rms always derived → C
  if (num(d.Mms)) s[16] = 'C';                       // Mms always derived → C
  mark(17, raw.Sd,   d.Sd);
  mark(19, raw.Vas,  d.Vas);

  // Secondary computed fields — C when their source fields exist
  if (num(d.Sd) && num(d.Xmax)) s[18] = 'C';         // Vd
  if (num(d.Sd))                s[21] = 'C';         // Dd
  if (num(d.Fs) && num(d.Vas) && num(d.Qes)) s[22] = 'C';       // eta0
  if (num(raw.Pe) && num(d.Sd) && num(d.Re)) { s[26] = 'C'; s[27] = 'C'; }  // SPLmax, SPLmaxLF
  if (num(raw.Pe)) s[28] = 'C';                      // USPL

  return s.join('');
}
