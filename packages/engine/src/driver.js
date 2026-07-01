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
export function deriveDriver(d) {
  const errors = [];
  const r = Object.assign({}, d);

  // Required fields — each missing one is a blocking error
  if (!(r.Fs > 0))  errors.push({ level: 'error', field: 'Fs',  message: 'Resonant frequency (Fs) is required and must be greater than zero' });
  if (!(r.Re > 0))  errors.push({ level: 'error', field: 'Re',  message: 'DC resistance (Re) is required and must be greater than zero' });
  if (!(r.Sd > 0))  errors.push({ level: 'error', field: 'Sd',  message: 'Piston area (Sd) is required — enter Sd or cone diameter' });
  if (!(r.Vas > 0)) errors.push({ level: 'error', field: 'Vas', message: 'Acoustic compliance volume (Vas) is required for moving-mass derivation' });

  // Q completeness — need at least two of {Qts, Qes, Qms} to solve the third
  const qCount = [r.Qts, r.Qes, r.Qms].filter(v => v > 0).length;
  if (qCount < 2) errors.push({ level: 'error', field: 'Qts', message: 'At least two Q parameters (Qts, Qes, Qms) are required — enter any two to derive the third' });

  // Pe is optional but its absence means max-power / max-SPL curves cannot be shown
  if (!(r.Pe > 0)) errors.push({ level: 'warn', field: 'Pe', message: 'Rated power (Pe) is not set — max-SPL and max-power curves will not be shown' });

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
function _parseSimpleYaml(text) {
  const r = {};
  const lines = text.split(/\r?\n/);
  let blockKey = null;
  const blockLines = [];

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

export function parseWdr(text, sidecarText) {
  const f = {};
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i < 0 || line[0] === '[') continue;
    f[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const n = k => { const v = parseFloat(f[k]); return isFinite(v) ? v : undefined; };
  const d = {};
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
  for (const k in d) if (d[k] === undefined) delete d[k];
  return { value: d, errors: [] };
}

export function toWdr(raw) {
  const { value: d } = deriveDriver(raw);
  if (!d) return '';
  const Sd  = d.Sd, Vd = Sd * (d.Xmax || 0), Dd = 2 * Math.sqrt(Sd / Math.PI);
  const g   = (x, p = 6) => (x == null || !isFinite(x)) ? '' : (+x.toPrecision(p));
  const brand = raw.brand || '', model = raw.model || '';
  // WinISD per-field edit-state flags: E=enabled, C=calculated, N=not-used.
  // The sequence maps to the WDR field list order (Qts, Znom, Fs, Pe, Re, Le, BL, Xmax, Cms, Qms, Qes, Rms, Mms, Sd, Vas, Vd, Dd, numVC, VCCon). Exact values are opaque to us — kept as WinISD requires.
  const ParState = 'EEECEENNEENEEEEEEEEEEECENNCCCNNNCCCCECNNNNNNNNECC';
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
