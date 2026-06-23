'use strict';
/* ============================================================================
   Resonate engine — lumped-element electro-mechano-acoustical circuit in the
   acoustical impedance analogy.

   Dual-export: loaded as a plain <script src> in the browser (adds to
   window.R) and as a CommonJS require() in Node (module.exports).  No ES
   module syntax so the browser path works from file:// without a bundler.
   ============================================================================ */

// ---- physical constants ----------------------------------------------------
const RHO = 1.184;   // air density  kg/m³  (20 °C)
const C   = 345.0;   // speed of sound  m/s
const P0  = 20e-6;   // reference SPL pressure  Pa  (0 dB)

// ---- complex number helpers ------------------------------------------------
const cx     = (re, im = 0) => ({ re, im });
const cAdd   = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
const cSub   = (a, b) => ({ re: a.re - b.re, im: a.im - b.im });
const cMul   = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cDiv   = (a, b) => { const d = b.re*b.re + b.im*b.im; return { re: (a.re*b.re + a.im*b.im)/d, im: (a.im*b.re - a.re*b.im)/d }; };
const cInv   = (a)    => { const d = a.re*a.re + a.im*a.im; return { re: a.re/d, im: -a.im/d }; };
const cAbs   = (a)    => Math.hypot(a.re, a.im);
const cArg   = (a)    => Math.atan2(a.im, a.re);
const cScale = (a, k) => ({ re: a.re * k, im: a.im * k });
const cPar   = (...zs) => cInv(zs.reduce((s, z) => cAdd(s, cInv(z)), cx(0, 0)));

// =========================================================================
//  DRIVER MODEL
//  Input may be partial; we derive a complete consistent small-signal set.
//  Canonical SI store: Fs[Hz] Qts Qes Qms Vas[m³] Sd[m²] Re[Ω] Le[H]
//                      Bl[Tm] Mms[kg] Cms[m/N] Rms[Ns/m] Xmax[m] Pe[W] Z[Ω]
// =========================================================================
function deriveDriver(d) {
  const r  = Object.assign({}, d);
  const ws = 2 * Math.PI * r.Fs;
  if (!r.Qts && r.Qes && r.Qms) r.Qts = (r.Qes * r.Qms) / (r.Qes + r.Qms);
  if (!r.Qes && r.Qts && r.Qms) r.Qes = (r.Qts * r.Qms) / (r.Qms - r.Qts);
  if (!r.Qms && r.Qts && r.Qes) r.Qms = (r.Qts * r.Qes) / (r.Qes - r.Qts);
  const Cas = r.Vas / (RHO * C * C);
  r.Cms = Cas / (r.Sd * r.Sd);
  r.Mms = 1 / (ws * ws * r.Cms);
  r.Rms = ws * r.Mms / r.Qms;
  r.Bl  = Math.sqrt(ws * r.Mms * r.Re / r.Qes);
  return r;
}

// =========================================================================
//  WinISD .wdr DRIVER FILES  (INI-style text, [Driver] section, SI units)
// =========================================================================
function parseWdr(text) {
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
  if (f.Brand)   d.brand   = f.Brand.trim();
  if (f.Model)   d.model   = f.Model.trim();
  const name = [f.Brand, f.Model].filter(x => x && x.length).join(' ').trim();
  if (name) d.name = name;
  if (f.Comment) d.comment = f.Comment;
  if (!(d.Fs && d.Sd && d.Re && (d.Vas || (d.Qts && d.Qes))))
    throw new Error('missing core T/S parameters');
  for (const k in d) if (d[k] === undefined) delete d[k];
  return d;
}

function toWdr(raw) {
  const d   = deriveDriver(raw);
  const Sd  = d.Sd, Vd = Sd * (d.Xmax || 0), Dd = 2 * Math.sqrt(Sd / Math.PI);
  const g   = (x, p = 6) => (x == null || !isFinite(x)) ? '' : (+x.toPrecision(p));
  const brand = raw.brand || '';
  const model = raw.model || raw.name || 'Driver';
  const ParState = 'EEECEENNEENEEEEEEEEEEECENNCCCNNNCCCCECNNNNNNNNECC';
  const L = [
    '[Driver]',
    'Brand=' + (brand || ''), 'Model=' + model,
    'Manufacturer=', 'ProvidedBy=Resonate',
    'Comment=' + (raw.comment || ''), 'DateAdded=', 'DateModified=',
    'Qts=' + g(d.Qts), 'Znom=' + g(d.Z || d.Re),
    'Fs=' + g(d.Fs), 'Pe=' + g(d.Pe), 'Re=' + g(d.Re), 'Le=' + g(d.Le),
    'BL=' + g(d.Bl), 'Xmax=' + g(d.Xmax),
    'Cms=' + g(d.Cms), 'Qms=' + g(d.Qms), 'Qes=' + g(d.Qes), 'Rms=' + g(d.Rms),
    'Mms=' + g(d.Mms), 'Sd=' + g(d.Sd), 'Vas=' + g(d.Vas),
    'Vd=' + g(Vd), 'Dd=' + g(Dd),
    'numVC=1', 'VCCon=2', 'ParState=' + ParState, '',
  ];
  return L.join('\n');
}

// =========================================================================
//  CIRCUIT SOLVER — one frequency, returns complex node quantities.
//  box: 'sealed' | 'vented' | 'bandpass4' | 'pr'
// =========================================================================
function portLoss(w, Map, P) {
  return w * Map / (P.Qp || 100);
}

function solve(f, drv, box, P) {
  const w      = 2 * Math.PI * f;
  const n      = P.nDrivers || 1;
  const wiring = P.wiring || 'parallel';
  const eg     = P.eg;
  const Sdt    = drv.Sd * n;
  const Zcoil1 = cAdd(cx(drv.Re, 0), cx(0, w * drv.Le));
  let Zcoil, Bl;
  if (wiring === 'series') { Zcoil = cScale(Zcoil1, n);     Bl = drv.Bl * n; }
  else                     { Zcoil = cScale(Zcoil1, 1 / n); Bl = drv.Bl; }
  const pg  = cDiv(cx(eg * Bl, 0), cMul(cx(Sdt, 0), Zcoil));
  const ZaE = cDiv(cx(Bl * Bl, 0), cMul(cx(Sdt * Sdt, 0), Zcoil));
  const Cas = drv.Cms * drv.Sd * drv.Sd * n;
  const Mas = drv.Mms / (drv.Sd * drv.Sd) / n;
  const Ras = drv.Rms / (drv.Sd * drv.Sd) / n;
  const ZaD = cAdd(cAdd(cx(Ras, 0), cx(0, w * Mas)), cInv(cx(0, w * Cas)));
  let Zbox, UP = cx(0, 0), U0, UD;
  const Vb  = P.Vb;
  const Cab = Vb / (RHO * C * C);
  const Zc  = cInv(cx(0, w * Cab));
  const Ql  = P.Ql || 7;
  const Ral = cx(Ql / (w * Cab), 0);
  if (box === 'sealed') {
    Zbox = cPar(Zc, Ral);
    UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
    U0 = UD;
  } else if (box === 'vented') {
    const Map = RHO * P.Leff / P.Sp, Rap = portLoss(w, Map, P);
    const Zport = cAdd(cx(Rap, 0), cx(0, w * Map));
    Zbox = cPar(Zc, Ral, Zport);
    UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
    UP = cMul(UD, cDiv(Zbox, Zport));
    U0 = cSub(UD, UP);
  } else if (box === 'pr') {
    const Sp  = P.prSd, Mmp = P.prMmp, Cmp = P.prCms;
    const Map = Mmp / (Sp * Sp), Cap = Cmp * Sp * Sp;
    const Rap = (P.prRms || 0) / (Sp * Sp);
    const Zpr = cAdd(cAdd(cx(Rap, 0), cx(0, w * Map)), cInv(cx(0, w * Cap)));
    Zbox = cPar(Zc, Ral, Zpr);
    UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
    UP = cMul(UD, cDiv(Zbox, Zpr));
    U0 = cSub(UD, UP);
  } else if (box === 'bandpass4') {
    const Cabr   = Vb / (RHO * C * C);
    const Zr     = cPar(cInv(cx(0, w * Cabr)), cx(Ql / (w * Cabr), 0));
    const Cabf   = P.Vf / (RHO * C * C);
    const Map    = RHO * P.Leff / P.Sp, Rap = portLoss(w, Map, P);
    const Zportf = cAdd(cx(Rap, 0), cx(0, w * Map));
    const Zf     = cPar(cInv(cx(0, w * Cabf)), cx(Ql / (w * Cabf), 0), Zportf);
    Zbox = cAdd(Zr, Zf);
    UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
    UP = cMul(UD, cDiv(Zf, Zportf));
    U0 = UP;
  }
  const Zel = cAdd(Zcoil, cDiv(cx(Bl * Bl, 0), cMul(cx(Sdt * Sdt, 0), cAdd(ZaD, Zbox))));
  return { U0, UD, UP, Zbox, Zel, ZaD };
}

// =========================================================================
//  SWEEP — compute every curve across a log-spaced frequency grid.
// =========================================================================
function unwrap(p) {
  const o = [p[0]];
  for (let i = 1; i < p.length; i++) {
    let d = p[i] - p[i - 1];
    while (d >  Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    o.push(o[i - 1] + d);
  }
  return o;
}

function sweep(drv, box, P) {
  const f0 = P.fmin || 10, f1 = P.fmax || 1000, N = P.N || 400;
  const fs = [], H = [], spl = [], exc = [], excPR = [], pv = [], zmag = [], zph = [], gd = [], phase = [];
  const r  = 1;
  for (let i = 0; i <= N; i++) {
    const f = f0 * Math.pow(f1 / f0, i / N);
    const s = solve(f, drv, box, P);
    const w = 2 * Math.PI * f;
    const Hc   = cScale(cMul(cx(0, w), s.U0), RHO / (2 * Math.PI * r));
    const pmag = cAbs(Hc);
    fs.push(f); H.push(Hc);
    spl.push(pmag > 0 ? 20 * Math.log10(pmag / P0) : -200);
    phase.push(cArg(Hc));
    const Sdt = drv.Sd * (P.nDrivers || 1);
    exc.push(Math.SQRT2 * cAbs(s.UD) / (w * Sdt) * 1000);
    const area = box === 'pr' ? P.prSd : P.Sp;
    pv.push(area ? Math.SQRT2 * cAbs(s.UP) / area : 0);
    excPR.push(box === 'pr' ? Math.SQRT2 * cAbs(s.UP) / (w * P.prSd) * 1000 : 0);
    zmag.push(cAbs(s.Zel));
    zph.push(cArg(s.Zel) * 180 / Math.PI);
  }
  const ph = unwrap(phase);
  for (let i = 0; i < fs.length; i++) {
    const a = Math.max(0, i - 1), b = Math.min(fs.length - 1, i + 1);
    const dw = 2 * Math.PI * (fs[b] - fs[a]);
    gd.push(dw !== 0 ? -(ph[b] - ph[a]) / dw * 1000 : 0);
  }
  return { fs, H, spl, phase: ph, exc, excPR, pv, zmag, zph, gd };
}

// =========================================================================
//  MAX SPL / MAX POWER — limited by Xmax and Pe at each frequency.
// =========================================================================
function maxCurves(drv, box, P) {
  const base = sweep(drv, box, Object.assign({}, P, { eg: 2.83 }));
  const Pe   = (drv.Pe || 50) * (P.nDrivers || 1);
  const Znom = drv.Z || drv.Re;
  const maxspl = [], maxpwr = [], xlim = [];
  for (let i = 0; i < base.fs.length; i++) {
    const splAt283 = base.spl[i];
    const excAt283 = base.exc[i] / 1000;
    const vXmax = excAt283 > 0 ? 2.83 * (drv.Xmax / excAt283) : 1e9;
    const vPe   = Math.sqrt(Pe * Znom);
    const vUse  = Math.min(vXmax, vPe);
    maxspl.push(splAt283 + 20 * Math.log10(vUse / 2.83));
    maxpwr.push(vUse * vUse / Znom);
    xlim.push(vXmax < vPe);
  }
  return { fs: base.fs, maxspl, maxpwr, xlim };
}

// =========================================================================
//  ALIGNMENT HELPERS
// =========================================================================
function ebp(drv) { return drv.Fs / drv.Qes; }

function sealedFromQtc(drv, Qtc) {
  const ratio = (Qtc / drv.Qts) ** 2 - 1;
  if (ratio <= 0) return null;
  return drv.Vas / ratio;
}

function ventedAlignment(drv) {
  const { Qts, Fs, Vas } = drv;
  const Vb   = 15 * Vas * Math.pow(Qts, 2.87);
  const fbB4 = Fs * Math.pow(Vas / Vb, 0.5);
  return { Vb, Fb: fbB4 };
}

function ventLength(Vb, fb, Sp) {
  const Cab = Vb / (RHO * C * C);
  const wb  = 2 * Math.PI * fb;
  const Map = 1 / (wb * wb * Cab);
  const d   = 2 * Math.sqrt(Sp / Math.PI);
  return Math.max(Map * Sp / RHO - 0.85 * d, 0.005);
}

function tuningFromLength(Vb, L, Sp) {
  const d    = 2 * Math.sqrt(Sp / Math.PI);
  const Leff = L + 0.85 * d;
  const Cab  = Vb / (RHO * C * C);
  const Map  = RHO * Leff / Sp;
  return 1 / (2 * Math.PI * Math.sqrt(Map * Cab));
}

function prTuning(P) {
  const Cab  = P.Vb / (RHO * C * C);
  const Map  = P.prMmp / (P.prSd * P.prSd);
  const Cap  = P.prCms * P.prSd * P.prSd;
  const Cpar = (Cab * Cap) / (Cab + Cap);
  return 1 / (2 * Math.PI * Math.sqrt(Map * Cpar));
}

function prMassForFp(P, fp) {
  const Cab  = P.Vb / (RHO * C * C);
  const Cap  = P.prCms * P.prSd * P.prSd;
  const Cpar = (Cab * Cap) / (Cab + Cap);
  const Map  = 1 / ((2 * Math.PI * fp) ** 2 * Cpar);
  return Map * P.prSd * P.prSd;
}

// ---- dual export -----------------------------------------------------------
const _API = {
  RHO, C, P0,
  cx, cAdd, cSub, cMul, cDiv, cInv, cAbs, cArg, cScale, cPar,
  deriveDriver, parseWdr, toWdr,
  solve, portLoss,
  sweep, unwrap, maxCurves,
  ebp, sealedFromQtc, ventedAlignment, ventLength, tuningFromLength, prTuning, prMassForFp,
};
if (typeof module !== 'undefined') module.exports = _API;
if (typeof window !== 'undefined') window.R = Object.assign(window.R || {}, _API);
