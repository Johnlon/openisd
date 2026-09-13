import { describe, it } from 'vitest';
import { Engine, LossMode } from '../engine/index.js';

const engine = new Engine();
const box = { Vb: 0.006, Ql: 10, Qa: 100 };
const W5 = {
  Fs: 45, Vas: 0.00485, Qts: 0.49,
  Qms: 3.56, Qes: 0.57, Re: 3.4,
  Cms: 0.00036872, Sd: 0.0094,
};

describe('W5-1138SMF sealed 6L Ql10 Qa100 Rg0.1 — feed-path comparison', () => {
  it('prints every variant', () => {
    const r = (label: string, p: { Fs: number; Qts: number; Vas: number }) => {
      const x = engine.sealedResonance(LossMode.WinisdLossy, { ...p, ...box });
      console.log(`VARIANT ${label}: Fsc=${x.Fsc.toFixed(10)} Qtc=${x.Qtc.toFixed(10)}`);
    };
    // A: engine canonical — stored Vas + stored Qts (no Rg)
    r('A storedVas storedQts', { Fs: W5.Fs, Qts: W5.Qts, Vas: W5.Vas });
    // B: Rg folded into Qts, stored Vas
    const qtsLoaded = engine.sourceLoadedQts(W5.Qms, W5.Qes, W5.Re, 0.1, W5.Qts);
    console.log(`INFO B qtsLoaded=${qtsLoaded}`);
    r('B storedVas qts+Rg', { Fs: W5.Fs, Qts: qtsLoaded, Vas: W5.Vas });
    // C: app path — Vas reconstructed from Cms·Sd²·ρc² (default air), stored Qts
    const air = engine.airFor({});
    const vasR = W5.Cms * W5.Sd ** 2 * air.rho * air.c ** 2;
    console.log(`INFO C air rho=${air.rho} c=${air.c} vasReconstructed=${vasR} (stored ${W5.Vas})`);
    r('C reconstructedVas storedQts', { Fs: W5.Fs, Qts: W5.Qts, Vas: vasR });
    // D: reconstructed Vas + Rg-folded Qts
    r('D reconstructedVas qts+Rg', { Fs: W5.Fs, Qts: qtsLoaded, Vas: vasR });
    // Lossless + conventional reference
    const ratio = Math.sqrt(1 + W5.Vas / box.Vb);
    console.log(`INFO lossless Fsc=Fs*sqrt(1+Vas/Vb)=${(W5.Fs * ratio).toFixed(6)} Qtc=${(W5.Qts * ratio).toFixed(6)}`);
    console.log(`INFO nominal parallel Qts=${(1 / (1 / W5.Qms + 1 / W5.Qes)).toFixed(6)}`);
  });
});