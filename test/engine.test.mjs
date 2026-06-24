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
import { deriveDriver, sweep, parseWdr, toWdr, prTuning, prMassForFp, RHO, C,
         highPass, lowPass, linkwitz, peakingEQ, applyFilters, cx, cAbs } from '../src/core/index.js';

const here = dirname(fileURLToPath(import.meta.url));

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
  const P = { Vb:0.02, Ql:7, eg:2.83, prSd:0.0133, prMmd:0.010, prMadd:0.020, prCms:0.0008,
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
  const target=42, totalM=prMassForFp(P, target), madd=totalM-P.prMmd, fp2=prTuning({ ...P, prMadd:madd });
  check('PR mass auto-tune hits the target Fp', Math.abs(fp2-target)<0.5,
        `target ${target} -> added ${(madd*1000).toFixed(1)} g -> ${fp2.toFixed(1)} Hz`);
}

// --- WinISD PR param round-trip (Fs+Qms+Vas ↔ Mms+Cms+Rms) ----------------
{
  const Fs = 25, Qms = 7, Vas_L = 18, Sd = 0.0133;
  // WinISD → T/S
  const Cms = (Vas_L / 1000) / (Sd * Sd * RHO * C * C);
  const Mms = 1 / ((2 * Math.PI * Fs) ** 2 * Cms);
  const Rms = Math.sqrt(Mms / Cms) / Qms;
  // T/S → WinISD back
  const Fs_rt  = 1 / (2 * Math.PI * Math.sqrt(Mms * Cms));
  const Qms_rt = Math.sqrt(Mms / Cms) / Rms;
  const Vas_rt = Cms * Sd * Sd * RHO * C * C * 1000;
  check('WinISD PR Fs round-trips',  Math.abs(Fs_rt  - Fs)    < 1e-9, `${Fs} → ${Fs_rt.toFixed(6)}`);
  check('WinISD PR Qms round-trips', Math.abs(Qms_rt - Qms)   < 1e-9, `${Qms} → ${Qms_rt.toFixed(6)}`);
  check('WinISD PR Vas round-trips', Math.abs(Vas_rt - Vas_L) < 1e-9, `${Vas_L} → ${Vas_rt.toFixed(6)}`);
}

// --- WinISD .wdr import + self-consistent round-trip ------------------------
{
  const text = readFileSync(join(here, '..', 'drivers', 'loudspeakerdatabase', 'Tang Band W5-1138SMF.wdr'), 'utf8');
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

// --- Filter chain -----------------------------------------------------------
{
  // No-op: empty filter array must not change any existing sweep output
  const d = deriveDriver({ ...testDrv, Le:0 }), Vb = 0.020;
  const base = sweep(d, 'sealed', { Vb, Ql:1e6, eg:2.83, fmin:10, fmax:1000, N:50 });
  const filt = sweep(d, 'sealed', { Vb, Ql:1e6, eg:2.83, fmin:10, fmax:1000, N:50, filters:[] });
  let maxDiff = 0;
  for (let i = 0; i < base.spl.length; i++) maxDiff = Math.max(maxDiff, Math.abs(base.spl[i]-filt.spl[i]));
  check('empty filters[] is a no-op on SPL', maxDiff === 0);

  // High-pass: at f = fc, |H| = 1/√2 → −3 dB; well above fc → 0 dB; well below → −40 dB/dec
  const hp = highPass(80, 80);               // f=fc → |H|=1/√2
  check('HP at fc = −3 dB', Math.abs(20*Math.log10(cAbs(hp)) - (-3.0103)) < 0.001);
  const hpHF = highPass(8000, 80);           // f >> fc → |H| ≈ 1
  check('HP well above fc ≈ 0 dB', Math.abs(20*Math.log10(cAbs(hpHF))) < 0.01);
  const hpLF = highPass(8, 80);             // f = fc/10 → 2nd order → −40 dB
  check('HP one decade below fc ≈ −40 dB', Math.abs(20*Math.log10(cAbs(hpLF)) - (-40)) < 0.5);

  // Low-pass: symmetric
  const lp = lowPass(80, 80);
  check('LP at fc = −3 dB', Math.abs(20*Math.log10(cAbs(lp)) - (-3.0103)) < 0.001);

  // Peaking EQ: gain at fc = gainDb, unity at DC and HF
  const peqBoost = peakingEQ(300, 300, 1.0, 6);
  check('PEQ boost: +6 dB at fc', Math.abs(20*Math.log10(cAbs(peqBoost)) - 6) < 0.01);
  const peqDC = peakingEQ(0.001, 300, 1.0, 6);
  check('PEQ: unity gain at DC', Math.abs(20*Math.log10(cAbs(peqDC))) < 0.1);
  const peqHF = peakingEQ(30000, 300, 1.0, 6);
  check('PEQ: unity gain at HF', Math.abs(20*Math.log10(cAbs(peqHF))) < 0.01);

  // Linkwitz transform: unity gain at HF (pole/zero both go to 1 above)
  const ltHF = linkwitz(30000, 50, 0.7, 20, 0.5);
  check('Linkwitz: unity gain at HF', Math.abs(20*Math.log10(cAbs(ltHF))) < 0.01);

  // applyFilters: disabled filter is skipped
  const filtered = applyFilters(1000, [{ type:'peaking', enabled:false, fc:1000, Q:1, gain:12 }]);
  check('disabled filter is a no-op', Math.abs(cAbs(filtered) - 1) < 1e-9);

  // Sweep with HP applied: SPL below fc must be lower than without
  const baseHP  = sweep(d, 'sealed', { Vb, Ql:1e6, eg:2.83, fmin:10, fmax:1000, N:50 });
  const filtHP  = sweep(d, 'sealed', { Vb, Ql:1e6, eg:2.83, fmin:10, fmax:1000, N:50,
                                        filters:[{ id:1, type:'highpass', enabled:true, fc:80, Q:0.7071 }] });
  const i10 = filtHP.fs.findIndex(x => x >= 10);
  check('sweep with HP: SPL at 10 Hz is reduced vs unfiltered', filtHP.spl[i10] < baseHP.spl[i10] - 20);
  const iHF = filtHP.fs.findIndex(x => x >= 800);
  check('sweep with HP: SPL above fc is nearly unchanged', Math.abs(filtHP.spl[iHF] - baseHP.spl[iHF]) < 0.5);
}

console.log(`\n${fails ? fails + ' check(s) FAILED' : 'All checks passed.'}\n`);
process.exit(fails ? 1 : 0);
