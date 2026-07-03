/**
 * Thiele-Small driver parameter derivation.
 *
 * Equations:
 *   https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 *
 * Authoritative source (paywalled):
 *   Small, R.H. "Direct-Radiator Loudspeaker System Analysis." JAES 20(5) 1972.
 *   https://aes.org/e-lib/browse.cfm?elib=2008
 */

import { RHO, C } from './constants.js';
import type { DriverRaw, Driver, DriverError, Result } from './types.js';

/**
 * Derive the full Thiele-Small parameter set from {Fs, Qts/Qes/Qms, Vas, Sd, Re, Le}.
 *
 * All equations: https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 *
 *   Qts = (Qes · Qms) / (Qes + Qms)
 *   Vas = ρ · c² · Sd² · Cms   →   Cms = Vas / (ρ · c² · Sd²)
 *   Mms = 1 / (ωs² · Cms)        from  ωs = 1/√(Mms · Cms)
 *   Rms = 2π · Fs · Mms / Qms
 *   Bl  = √(2π · Fs · Mms · Re / Qes)
 */
export function deriveDriver(d: DriverRaw): Result<Driver> {
  const errors: DriverError[] = [];
  // The working copy becomes a fully-derived Driver once validation passes below;
  // the single cast lets us assign the derived fields. Guarded reads (r.Fs > 0)
  // tolerate the pre-validation undefined values fine.
  const r = Object.assign({}, d) as Driver;

  // Required fields — each missing one is a blocking error
  if (!(r.Fs > 0))  errors.push({ level: 'error', field: 'Fs',  message: 'Resonant frequency (Fs) is required and must be greater than zero' });
  if (!(r.Re > 0))  errors.push({ level: 'error', field: 'Re',  message: 'DC resistance (Re) is required and must be greater than zero' });
  if (!(r.Sd > 0))  errors.push({ level: 'error', field: 'Sd',  message: 'Piston area (Sd) is required — enter Sd or cone diameter' });
  if (!(r.Vas > 0)) errors.push({ level: 'error', field: 'Vas', message: 'Acoustic compliance volume (Vas) is required for moving-mass derivation' });

  // Q completeness — need at least two of {Qts, Qes, Qms} to solve the third
  const qCount = [r.Qts, r.Qes, r.Qms].filter(v => v > 0).length;
  if (qCount < 2) errors.push({ level: 'error', field: 'Qts', message: 'At least two Q parameters (Qts, Qes, Qms) are required — enter any two to derive the third' });

  // Deriving the third Q divides by (Qms−Qts) or (Qes−Qts). Qts is the parallel
  // combination of Qes and Qms, so physically Qms > Qts and Qes > Qts. Equal or
  // inverted values make the denominator zero/negative → Qes/Qms = Infinity/negative,
  // which would silently poison Bl and the whole circuit. Reject as a blocking error.
  if (!(r.Qes > 0) && r.Qts > 0 && r.Qms > 0 && r.Qms <= r.Qts)
    errors.push({ level: 'error', field: 'Qms', message: 'Qms must be greater than Qts (Qts is the parallel combination of Qes and Qms)' });
  if (!(r.Qms > 0) && r.Qts > 0 && r.Qes > 0 && r.Qes <= r.Qts)
    errors.push({ level: 'error', field: 'Qes', message: 'Qes must be greater than Qts (Qts is the parallel combination of Qes and Qms)' });

  // Optional fields — absence does NOT block derivation; it only drops one reference
  // line from a chart. Reported as warnings so the UI can list them (dismissable) and
  // still draw the reliable curve.
  if (!(r.Pe! > 0))   errors.push({ level: 'warn', field: 'Pe',   message: 'Rated power (Pe) is not set — the thermal-limit line is omitted from the Max-SPL and Max-power charts' });
  if (!(r.Xmax! > 0)) errors.push({ level: 'warn', field: 'Xmax', message: 'Peak excursion (Xmax) is not set — the Xmax limit line is omitted from the Excursion and Max-SPL charts' });

  if (errors.some(e => e.level === 'error')) return { value: null, errors };

  // Derive the third Q from whichever two are provided
  if (!r.Qts && r.Qes && r.Qms) r.Qts = (r.Qes * r.Qms) / (r.Qes + r.Qms);
  if (!r.Qes && r.Qts && r.Qms) r.Qes = (r.Qts * r.Qms) / (r.Qms - r.Qts);
  if (!r.Qms && r.Qts && r.Qes) r.Qms = (r.Qts * r.Qes) / (r.Qes - r.Qts);

  const ws  = 2 * Math.PI * r.Fs;
  const Cas = r.Vas / (RHO * C * C);   // Cms = Vas/(ρc²Sd²)  https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
  r.Cms = Cas / (r.Sd * r.Sd);
  r.Mms = 1 / (ws * ws * r.Cms);       // Mms = 1/(ωs²·Cms)
  r.Rms = ws * r.Mms / r.Qms;          // Rms = 2π·Fs·Mms/Qms
  r.Bl  = Math.sqrt(ws * r.Mms * r.Re / r.Qes);  // Bl = √(2π·Fs·Mms·Re/Qes)

  return { value: r, errors };
}

/**
 * Minimal YAML sidecar parser — supports key:value, null/empty (→ absent),
 * single-quoted strings with '' escape, and block scalars (|).
 * Private — only called from parseWdr.
 */
function _parseSimpleYaml(text: string): Record<string, string | null> {
  const r: Record<string, string | null> = {};
  const lines = text.split(/\r?\n/);
  let blockKey: string | null = null;
  const blockLines: string[] = [];

  for (const line of lines) {
    if (blockKey !== null && line.length > 0 && (line[0] === ' ' || line[0] === '\t')) {
      blockLines.push(line.trimStart());
      continue;
    }
    if (blockKey !== null) {
      r[blockKey] = blockLines.join('\n');
      blockKey = null;
      blockLines.length = 0;
    }
    const i = line.indexOf(':');
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (v === '|') { blockKey = k; continue; }
    if (!v || v === 'null') { r[k] = null; continue; }
    if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1).replace(/''/g, "'");
    r[k] = v;
  }
  if (blockKey !== null) r[blockKey] = blockLines.join('\n');
  return r;
}

export function parseWdr(text: string, sidecarText?: string): Result<DriverRaw> {
  const f: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i < 0 || line[0] === '[') continue;
    f[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const n = (k: string): number | undefined => { const v = parseFloat(f[k]); return isFinite(v) ? v : undefined; };
  const d: DriverRaw = {};
  d.Fs = n('Fs'); d.Qts = n('Qts'); d.Qes = n('Qes'); d.Qms = n('Qms');
  d.Vas = n('Vas'); d.Sd = n('Sd'); d.Re = n('Re'); d.Le = n('Le');
  d.Xmax = n('Xmax'); d.Pe = n('Pe'); d.Z = n('Znom');
  if (f.Brand)      d.brand      = f.Brand.trim();
  if (f.Model)      d.model      = f.Model.trim();
  const name = [f.Brand, f.Model].filter(x => x && x.length).join(' ').trim();
  if (name) d.name = name;
  if (f.ProvidedBy)              d.providedBy    = f.ProvidedBy.trim();
  if (f.Comment)                 d.comment       = f.Comment.trim();
  if (sidecarText) {
    const s = _parseSimpleYaml(sidecarText);
    if (s.datasheet_url)   d.datasheetUrl  = s.datasheet_url;
    if (s.vendor_page_url) d.vendorpageUrl = s.vendor_page_url;
    if (s.source)          d.sourceUrl     = s.source;
    if (s.frd_url)         d.frdUrl        = s.frd_url;
    if (s.zma_url)         d.impedanceUrl  = s.zma_url;
  }
  const dRec = d as Record<string, unknown>;
  for (const k in dRec) if (dRec[k] === undefined) delete dRec[k];
  return { value: d, errors: [] };
}

export function toWdr(raw: DriverRaw): string {
  const { value: d } = deriveDriver(raw);
  if (!d) return '';
  const Sd  = d.Sd, Vd = Sd * (d.Xmax || 0), Dd = 2 * Math.sqrt(Sd / Math.PI);
  const g   = (x: number | null | undefined, p = 6): string | number => (x == null || !isFinite(x)) ? '' : (+x.toPrecision(p));
  const brand = raw.brand || '', model = raw.model || '';
  const ParState = parstate(d);
  const L = [
    '[Driver]', 'Brand=' + brand, 'Model=' + model, 'Manufacturer=',
    'ProvidedBy=Resonate', 'Comment=' + (raw.comment || ''), 'DateAdded=', 'DateModified=',
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
 * Build WinISD's 49-char ParState string for an exported driver: the per-field edit
 * state in WinISD's internal field order — E (field present/entered), C (WinISD
 * derives it), N (absent). Ported from scraper_lib._parstate; positions are
 * probe-confirmed against real WinISD files (drivers/sample/). Computed per-driver,
 * so a driver missing an optional field (Pe, Xmax) marks that position N, not E —
 * unlike the old hardcoded string, which claimed every field was present.
 */
export function parstate(d: Driver): string {
  const s = new Array<string>(49).fill('N');
  const has = (v: number | null | undefined): boolean => v != null && isFinite(v);

  // Fixed positions (probe-confirmed)
  s[23] = 'E';                                       // numVC (WinISD defaults to 1)
  for (const p of [32, 33, 34, 35, 36, 37]) s[p] = 'C'; // gamma, EBP, Rme, Mpow, Mcost, Gloss
  s[47] = 'C'; s[48] = 'C';                          // c (speed of sound), roo (air density)
  s[3]  = 'C';                                       // SPL — WinISD computes it (Resonate supplies none)

  // T/S fields — E when written to the file (Znom is always written: Z or Re fallback)
  s[0] = 'E';                                        // Znom
  if (has(d.Fs))   s[1]  = 'E';
  if (has(d.Pe))   s[2]  = 'E';
  if (has(d.Re))   s[4]  = 'E';
  if (has(d.Le))   s[5]  = 'E';
  if (has(d.Bl))   s[8]  = 'E';
  if (has(d.Xmax)) s[9]  = 'E';
  if (has(d.Cms))  s[11] = 'E';
  if (has(d.Qms))  s[12] = 'E';
  if (has(d.Qes))  s[13] = 'E';
  if (has(d.Qts))  s[14] = 'E';
  if (has(d.Rms))  s[15] = 'E';
  if (has(d.Mms))  s[16] = 'E';
  if (has(d.Sd))   s[17] = 'E';
  if (has(d.Vas))  s[19] = 'E';

  // Computed fields — C when their source fields are available
  if (has(d.Sd) && has(d.Xmax)) s[18] = 'C';         // Vd
  if (has(d.Sd))                s[21] = 'C';         // Dd
  if (has(d.Fs) && has(d.Vas) && has(d.Qes)) s[22] = 'C';       // eta0
  if (has(d.Sd) && has(d.Re) && has(d.Pe)) { s[26] = 'C'; s[27] = 'C'; }  // SPLmax, SPLmaxLF
  if (has(d.Pe)) s[28] = 'C';                        // USPL

  return s.join('');
}
