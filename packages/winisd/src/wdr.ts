/**
 * WinISD .wdr interop — parse/serialise and ParState provenance.
 *
 * This is the WinISD-specific layer (per ARCHITECTURE.md AD-6): file-format and
 * ParState concerns live here, not in the pure-physics @openisd/engine core. The
 * physics (`deriveDriver`) is imported from the engine; nothing here belongs in it.
 */

import { deriveDriver } from '@openisd/engine';
import type { DriverRaw, Driver, Result } from '@openisd/engine';

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
 * Build WinISD's 49-char ParState string for an exported driver: per-field edit state
 * in WinISD's internal field order — E (a value the human/source ENTERED), C (a value
 * the app COMPUTED), N (absent). Positions are probe-confirmed against real WinISD
 * files (drivers/sample/; see scraper_lib._parstate).
 *
 * E vs C cannot be told from presence alone — Cms/Mms/Rms/Bl and a derived Q are all
 * "present" in the derived driver but were computed, not entered. So we compare `raw`
 * (what was supplied) against `d` (what deriveDriver produced): in raw → E; derived
 * but not in raw → C; in neither → N.
 *
 * Limitation: for a driver LOADED from a .wdr, `raw` carries no record of which fields
 * were originally E vs C, so every stored field reads as "supplied" (E). Faithful
 * round-tripping would require preserving the imported ParState or tracking per-field
 * edit state in the app — a separate change.
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
