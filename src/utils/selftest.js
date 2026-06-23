import { RHO, C, P0 } from '../core/constants.js';
import { deriveDriver } from '../core/driver.js';
import { sweep } from '../core/sweep.js';

export function runSelfTest() {
  const raw = { Fs:37, Qts:0.38, Qes:0.40, Qms:7.0, Vas:0.030, Sd:0.0133, Re:5.6, Le:0.7e-3, Xmax:0.005, Pe:60, Z:8 };
  const d = deriveDriver(raw), Vb = 0.020;
  const di = { ...d, Le: 0 };
  const fc = d.Fs * Math.sqrt(1 + d.Vas / Vb), Qtc = d.Qts * Math.sqrt(1 + d.Vas / Vb);
  const Psl = { Vb, Ql:1e6, nDrivers:1, wiring:'parallel', eg:2.83, fmin:10, fmax:1000, N:300 };
  const sw = sweep(di, 'sealed', Psl);
  const ref = sw.spl[sw.spl.length - 1]; let e1 = 0;
  for (let i = 0; i < sw.fs.length; i++) {
    const x = sw.fs[i] / fc;
    const g2 = (x ** 4) / ((1 - x * x) ** 2 + (x * x) / (Qtc * Qtc));
    e1 = Math.max(e1, Math.abs(sw.spl[i] - (ref + 10 * Math.log10(g2))));
  }
  const eta0 = (4 * Math.PI ** 2 / C ** 3) * (d.Fs ** 3 * d.Vas) / d.Qes;
  const sens283 = 112.1 + 10 * Math.log10(eta0) + 10 * Math.log10(2.83 ** 2 / d.Re);
  const i300 = sw.fs.findIndex(f => f >= 300); const pb = sw.spl[i300];
  const Cab = Vb / (RHO * C * C), fb = 30, wb = 2 * Math.PI * fb, Map = 1 / (wb * wb * Cab), Sp = Math.PI * 0.025 ** 2;
  const Pv = { ...Psl, Ql:7, Sp, Leff: Map * Sp / RHO };
  const sv = sweep(d, 'vented', Pv);
  const ia = sv.fs.findIndex(f => f >= 12), ib = sv.fs.findIndex(f => f >= 15);
  const slope = (sv.spl[ib] - sv.spl[ia]) / Math.log2(sv.fs[ib] / sv.fs[ia]);
  const peaks = [];
  for (let i = 1; i < sv.zmag.length - 1; i++)
    if (sv.zmag[i] > sv.zmag[i-1] && sv.zmag[i] > sv.zmag[i+1] && sv.zmag[i] > d.Re * 1.5)
      peaks.push(+sv.fs[i].toFixed(1));
  const p1 = e1 < 0.1, p2 = Math.abs(pb - sens283) < 0.5, p3 = Math.abs(slope - 24) < 3 && peaks.length === 2;
  console.log('[Resonate self-test]',
    `GATE1 sealed≡closed-form: max err ${e1.toFixed(4)} dB → ${p1?'PASS':'FAIL'}`,
    `GATE2 sensitivity: circuit ${pb.toFixed(2)} vs predicted ${sens283.toFixed(2)} dB → ${p2?'PASS':'FAIL'}`,
    `GATE3 vented slope ${slope.toFixed(1)} dB/oct, peaks ${JSON.stringify(peaks)} → ${p3?'PASS':'FAIL'}`,
    `OVERALL: ${p1&&p2&&p3?'ALL PASS':'FAIL'}`);
  window._selfTestDone = true;
  return { p1, p2, p3 };
}
