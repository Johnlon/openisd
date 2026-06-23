'use strict';
// Depends on: constants (RHO, C), complex
const isNode = typeof window === 'undefined';
const { RHO, C } = isNode ? require('./constants.js') : window.R;
const { cx, cAdd, cSub, cMul, cDiv, cInv, cScale, cPar } =
  isNode ? require('./complex.js') : window.R;

// =========================================================================
//  CIRCUIT SOLVER — one frequency, returns complex node quantities.
//  box: 'sealed' | 'vented' | 'bandpass4' | 'pr'
// =========================================================================
function solve(f, drv, box, P) {
  const w      = 2 * Math.PI * f;
  const n      = P.nDrivers || 1;
  const wiring = P.wiring || 'parallel';
  const eg     = P.eg;

  // n identical drivers as one equivalent cluster
  const Sdt    = drv.Sd * n;
  const Zcoil1 = cAdd(cx(drv.Re, 0), cx(0, w * drv.Le));
  let Zcoil, Bl;
  if (wiring === 'series') { Zcoil = cScale(Zcoil1, n); Bl = drv.Bl * n; }
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
  }
  else if (box === 'vented') {
    const Sp = P.Sp, Leff = P.Leff;
    const Map = RHO * Leff / Sp;
    const Rap = portLoss(w, Map, P);
    const Zport = cAdd(cx(Rap, 0), cx(0, w * Map));
    Zbox = cPar(Zc, Ral, Zport);
    UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
    UP = cMul(UD, cDiv(Zbox, Zport));
    U0 = cSub(UD, UP);
  }
  else if (box === 'pr') {
    const Sp  = P.prSd, Mmp = P.prMmp, Cmp = P.prCms;
    const Map = Mmp / (Sp * Sp), Cap = Cmp * Sp * Sp;
    const Rap = (P.prRms || 0) / (Sp * Sp);
    const Zpr = cAdd(cAdd(cx(Rap, 0), cx(0, w * Map)), cInv(cx(0, w * Cap)));
    Zbox = cPar(Zc, Ral, Zpr);
    UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
    UP = cMul(UD, cDiv(Zbox, Zpr));
    U0 = cSub(UD, UP);
  }
  else if (box === 'bandpass4') {
    const Cabr  = Vb / (RHO * C * C);
    const Zr    = cPar(cInv(cx(0, w * Cabr)), cx(Ql / (w * Cabr), 0));
    const Vf    = P.Vf, Cabf = Vf / (RHO * C * C);
    const Sp    = P.Sp, Leff = P.Leff;
    const Map   = RHO * Leff / Sp, Rap = portLoss(w, Map, P);
    const Zportf = cAdd(cx(Rap, 0), cx(0, w * Map));
    const Zf    = cPar(cInv(cx(0, w * Cabf)), cx(Ql / (w * Cabf), 0), Zportf);
    Zbox = cAdd(Zr, Zf);
    UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
    UP = cMul(UD, cDiv(Zf, Zportf));
    U0 = UP;
  }

  const Zel = cAdd(Zcoil, cDiv(cx(Bl * Bl, 0), cMul(cx(Sdt * Sdt, 0), cAdd(ZaD, Zbox))));
  return { U0, UD, UP, Zbox, Zel, ZaD };
}

function portLoss(w, Map, P) {
  const Qp = P.Qp || 100;
  return w * Map / Qp;
}

const API = { solve, portLoss };
if (typeof module !== 'undefined') module.exports = API;
if (typeof window !== 'undefined') window.R = Object.assign(window.R || {}, API);
