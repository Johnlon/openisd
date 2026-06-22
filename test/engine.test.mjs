/* =============================================================================
 * Resonate — engine validation tests
 *
 * "Trust is the whole game." This is that promise made runnable. It extracts the
 * simulation engine straight out of index.html (no duplicate copy to drift) and
 * checks it against the closed-form Thiele/Small physics. If you change the
 * engine, run this. A green run is the contract.
 *
 *   node test/engine.test.mjs
 * ===========================================================================*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(here, '..', 'index.html'), 'utf8');

// Pull the pure-engine portion (everything before the DOM/canvas code) and
// expose its functions without touching a browser.
const start = html.indexOf('"use strict";') + 13;
const end   = html.indexOf('CANVAS PLOTTER');
const engineSrc = html.slice(start, html.lastIndexOf('/*', end));
const api = new Function(engineSrc +
  '\nreturn {deriveDriver,sweep,maxCurves,parseWdr,toWdr,prTuning,prMassForFp,ventedAlignment,RHO,C};')();
const { deriveDriver, sweep, parseWdr, toWdr, prTuning, prMassForFp, RHO, C } = api;

let fails = 0;
const check = (name, ok, detail='') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  —  ' + detail : ''}`);
  if (!ok) fails++;
};
const idx = (fs, f) => fs.findIndex(x => x >= f);

const testDrv = { Fs:37, Qts:0.38, Qes:0.40, Qms:7.0, Vas:0.030, Sd:0.0133,
                  Re:5.6, Le:0.7e-3, Xmax:0.005, Pe:60, Z:8 };

console.log('\nResonate engine validation\n');

// --- GATE 1: sealed circuit ≡ closed form (the go/no-go gate) ----------------
{
  const d  = deriveDriver({ ...testDrv, Le:0 });
  const Vb = 0.020;
  const fc = d.Fs*Math.sqrt(1+d.Vas/Vb), Qtc = d.Qts*Math.sqrt(1+d.Vas/Vb);
  const sw = sweep(d, 'sealed', { Vb, Ql:1e6, eg:2.83, fmin:10, fmax:1000, N:300 });
  const ref = sw.spl.at(-1);
  let e = 0;
  for (let i=0;i<sw.fs.length;i++){
    const x=sw.fs[i]/fc, g2=(x**4)/((1-x*x)**2+(x*x)/(Qtc*Qtc));
    e = Math.max(e, Math.abs(sw.spl[i]-(ref+10*Math.log10(g2))));
  }
  check('sealed box matches closed form fc/Qtc', e < 0.1, `max err ${e.toFixed(4)} dB`);
}

// --- GATE 2: passband asymptotes to reference sensitivity --------------------
{
  const d  = deriveDriver({ ...testDrv, Le:0 });
  const Vb = 0.020;
  const eta0 = (4*Math.PI**2/(C*C*C))*(d.Fs**3*d.Vas)/d.Qes;
  const predicted = 112.1 + 10*Math.log10(eta0) + 10*Math.log10(2.83**2/d.Re);
  const sw = sweep(d, 'sealed', { Vb, Ql:1e6, eg:2.83, fmin:10, fmax:1000, N:300 });
  const pb = sw.spl[idx(sw.fs, 300)];
  check('passband SPL = driver reference sensitivity', Math.abs(pb-predicted) < 0.5,
        `${pb.toFixed(2)} vs ${predicted.toFixed(2)} dB`);
}

// --- GATE 3: vented gives 24 dB/oct + two impedance peaks straddling Fb ------
{
  const d = deriveDriver(testDrv), Vb = 0.020;
  const Cab=Vb/(RHO*C*C), fb=30, wb=2*Math.PI*fb, Map=1/(wb*wb*Cab), Sp=Math.PI*0.025**2;
  const sw = sweep(d, 'vented', { Vb, Ql:7, Sp, Leff:Map*Sp/RHO, eg:2.83, fmin:10, fmax:1000, N:300 });
  const a=idx(sw.fs,12), b=idx(sw.fs,15);
  const slope=(sw.spl[b]-sw.spl[a])/Math.log2(sw.fs[b]/sw.fs[a]);
  const peaks=[];
  for(let i=1;i<sw.zmag.length-1;i++)
    if(sw.zmag[i]>sw.zmag[i-1]&&sw.zmag[i]>sw.zmag[i+1]&&sw.zmag[i]>d.Re*1.5) peaks.push(+sw.fs[i].toFixed(1));
  check('vented rolls off ~24 dB/oct', Math.abs(slope-24)<3, `${slope.toFixed(1)} dB/oct`);
  check('vented shows two impedance peaks straddling Fb', peaks.length===2 && peaks[0]<fb && peaks[1]>fb,
        `peaks ${JSON.stringify(peaks)} around Fb=${fb}`);
}

// --- Passive radiator: excursion curve, Fp tuning, mass auto-tune ------------
{
  const d = deriveDriver(testDrv);
  const P = { Vb:0.02, Ql:7, eg:2.83, prSd:0.0133, prMmp:0.030, prCms:0.0008,
              prRms:1.0, prXmax:0.012, fmin:10, fmax:1000, N:300 };
  const sw = sweep(d, 'pr', P);
  check('PR diaphragm excursion curve is produced',
        sw.excPR.length===sw.fs.length && Math.max(...sw.excPR)>0,
        `peak ${Math.max(...sw.excPR).toFixed(2)} mm`);
  const peaks=[];
  for(let i=1;i<sw.zmag.length-1;i++)
    if(sw.zmag[i]>sw.zmag[i-1]&&sw.zmag[i]>sw.zmag[i+1]&&sw.zmag[i]>d.Re*1.5) peaks.push(sw.fs[i]);
  const fp = prTuning(P);
  check('PR tuning Fp sits between the impedance peaks',
        peaks.length===2 && fp>peaks[0] && fp<peaks[1], `Fp ${fp.toFixed(1)} Hz`);
  const target=42, m=prMassForFp(P, target), fp2=prTuning({ ...P, prMmp:m });
  check('PR mass auto-tune hits the target Fp', Math.abs(fp2-target)<0.5,
        `target ${target} -> ${(m*1000).toFixed(1)} g -> ${fp2.toFixed(1)} Hz`);
}

// --- WinISD .wdr import + self-consistent round-trip ------------------------
{
  const text = readFileSync(join(here, '..', 'drivers', 'TangBand-W5-1138SMF.wdr'), 'utf8');
  const imp = parseWdr(text);
  check('.wdr import reads brand/model + core T/S',
        imp.name==='Tang Band W5-1138SMF' && imp.Fs===45 && imp.Sd===0.0094,
        imp.name);
  const rt = parseWdr(toWdr(imp));
  let ok = true;
  for (const k of ['Fs','Qts','Qes','Qms','Vas','Sd','Re','Le','Xmax','Pe','Z'])
    if (imp[k]!=null && Math.abs(imp[k]-rt[k]) > Math.abs(imp[k])*1e-4+1e-9) ok = false;
  check('.wdr export round-trips the measured T/S exactly', ok);
  const d = deriveDriver(rt);
  check('exported .wdr is internally self-consistent (Fs/Qts/Qes preserved)',
        Math.abs(d.Fs-45)<1e-6 && Math.abs(d.Qts-0.49)<1e-3 && Math.abs(d.Qes-0.57)<1e-3);
}

console.log(`\n${fails ? fails + ' check(s) FAILED' : 'All checks passed.'}\n`);
process.exit(fails ? 1 : 0);
