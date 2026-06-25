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
  const r  = Object.assign({}, d);
  const ws = 2 * Math.PI * r.Fs;
  if (!r.Qts && r.Qes && r.Qms) r.Qts = (r.Qes * r.Qms) / (r.Qes + r.Qms);
  if (!r.Qes && r.Qts && r.Qms) r.Qes = (r.Qts * r.Qms) / (r.Qms - r.Qts);
  if (!r.Qms && r.Qts && r.Qes) r.Qms = (r.Qts * r.Qes) / (r.Qes - r.Qts);
  const Cas = r.Vas / (RHO * C * C);   // Cms = Vas/(ρc²Sd²)  https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
  r.Cms = Cas / (r.Sd * r.Sd);
  r.Mms = 1 / (ws * ws * r.Cms);       // Mms = 1/(ωs²·Cms)
  r.Rms = ws * r.Mms / r.Qms;          // Rms = 2π·Fs·Mms/Qms
  r.Bl  = Math.sqrt(ws * r.Mms * r.Re / r.Qes);  // Bl = √(2π·Fs·Mms·Re/Qes)
  return r;
}

export function parseWdr(text) {
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
  if (f.boxbench_datasheet)      d.datasheetUrl  = f.boxbench_datasheet.trim();
  if (f.boxbench_manu_page)      d.manuPageUrl   = f.boxbench_manu_page.trim();
  if (f.boxbench_vendor_page)    d.vendorpageUrl = f.boxbench_vendor_page.trim();
  if (f.boxbench_source)         d.sourceUrl     = f.boxbench_source.trim();
  if (f.boxbench_frd)            d.frdUrl        = f.boxbench_frd.trim();
  if (f.boxbench_impedance)      d.impedanceUrl  = f.boxbench_impedance.trim();
  if (!(d.Fs && d.Sd && d.Re && (d.Vas || (d.Qts && d.Qes))))
    throw new Error('missing core T/S parameters');
  for (const k in d) if (d[k] === undefined) delete d[k];
  return d;
}

export function toWdr(raw) {
  const d   = deriveDriver(raw);
  const Sd  = d.Sd, Vd = Sd * (d.Xmax || 0), Dd = 2 * Math.sqrt(Sd / Math.PI);
  const g   = (x, p = 6) => (x == null || !isFinite(x)) ? '' : (+x.toPrecision(p));
  const brand = raw.brand || '', model = raw.model || '';
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
