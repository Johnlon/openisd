/**
 * The WinISD oracle values are WinISD Pro 0.7.0.950's own `[Box] Fr` readout, captured by
 * reverse-engineering + live gdb capture (research repo SEALED_FSC_MODEL.md §4). The reference
 * driver is Fs=40, Vas=7.47 L, with the Qts WinISD derives for it (0.395643).
 */
import { describe, it, expect } from 'vitest';
import { LossMode, sealedResonance, sealedFscWinisd, sourceLoadedQts } from '../src/lossMode.js';

const DRIVER = { Fs: 40, Vas: 0.00747, Qts: 0.395643 };
const p = (Vb: number, Ql: number, Qa = 10000) => ({ ...DRIVER, Vb, Ql, Qa });

describe('Sealed-Box Resonance Loss Models', () => {
  describe('WinisdLossy — bit-exact to WinISD readout', () => {
    // WinISD [Box] Fr at Vb=6 L, QA=10000, over the QL sweep (SEALED_FSC_MODEL.md §6).
    const oracle: [number, number][] = [
      [2, 74.60915], [5, 65.73862], [10, 62.79619], [20, 61.35111], [100, 60.21429],
    ];
    for (const [Ql, fr] of oracle) {
      it(`Vb=6L Ql=${Ql} → ${fr} Hz`, () => {
        expect(sealedFscWinisd(p(0.006, Ql))).toBeCloseTo(fr, 4);
      });
    }
    // Other volumes at Ql=10 (same driver) — from the oracle grid.
    it('tracks volume at Ql=10 (10L, 20L, 40L)', () => {
      expect(sealedFscWinisd(p(0.010, 10))).toBeCloseTo(55.14994, 3);
      expect(sealedFscWinisd(p(0.020, 10))).toBeCloseTo(48.40568, 3);
      expect(sealedFscWinisd(p(0.040, 10))).toBeCloseTo(44.50218, 3);
    });
  });

  describe('WinisdLossy converges to lossless as leakage vanishes', () => {
    it('Ql→∞ equals fs·√(1+Vas/Vb)', () => {
      const lossless = 40 * Math.sqrt(1 + 0.00747 / 0.006);
      expect(sealedFscWinisd(p(0.006, 1e9))).toBeCloseTo(lossless, 6);
    });
    it('resonance rises monotonically as Ql falls', () => {
      const f = (Ql: number) => sealedFscWinisd(p(0.006, Ql));
      expect(f(2)).toBeGreaterThan(f(5));
      expect(f(5)).toBeGreaterThan(f(10));
      expect(f(10)).toBeGreaterThan(f(100));
    });
  });

  describe('Lossless mode = textbook sealed resonance', () => {
    it('Fsc = fs·√(1+Vas/Vb), independent of Ql/Qa', () => {
      const r1 = sealedResonance(LossMode.Lossless, p(0.006, 10));
      const r2 = sealedResonance(LossMode.Lossless, p(0.006, 2));
      const expected = 40 * Math.sqrt(1 + 0.00747 / 0.006);
      expect(r1.Fsc).toBeCloseTo(expected, 9);
      expect(r2.Fsc).toBeCloseTo(expected, 9); // Ql does not move it
      expect(r1.Qtc).toBeCloseTo(0.395643 * Math.sqrt(1 + 0.00747 / 0.006), 9);
    });
  });

  describe('ConventionalLossy keeps fc fixed, folds losses into Q', () => {
    it('Fsc equals lossless; Qtc combines 1/Qtc + 1/Ql + 1/Qa', () => {
      const r = sealedResonance(LossMode.ConventionalLossy, p(0.006, 10, 100));
      const lossless = 40 * Math.sqrt(1 + 0.00747 / 0.006);
      const qtcLossless = 0.395643 * Math.sqrt(1 + 0.00747 / 0.006);
      expect(r.Fsc).toBeCloseTo(lossless, 9); // frequency unchanged
      expect(r.Qtc).toBeCloseTo(1 / (1 / qtcLossless + 1 / 10 + 1 / 100), 9);
    });
  });

  describe('LossMode enum', () => {
    it('has exactly three members with WinISD as default', () => {
      expect(LossMode.ALL.map(m => m.value)).toEqual(['lossless', 'conventional-lossy', 'winisd-lossy']);
      expect(LossMode.Default).toBe(LossMode.WinisdLossy);
    });
    it('parses wire values and falls back to the default', () => {
      expect(LossMode.parse('lossless')).toBe(LossMode.Lossless);
      expect(LossMode.parse('winisd-lossy')).toBe(LossMode.WinisdLossy);
      expect(LossMode.parse('nonsense')).toBe(LossMode.Default);
      expect(LossMode.parse(null)).toBe(LossMode.Default);
    });
  });

  // Dayton Audio Epique E150HE-44 in a 6 L sealed box — the case the user reported showing a
  // broken "20 kHz / Qtc 0" readout (that came from the impedance-peak scan, which for any
  // driver with voice-coil inductance returns the HF inductive rise as the global |Z| max).
  //
  // GOLDEN = WinISD Pro's own readout, measured by the user:
  //   WinISD lossy (Ql=10, Qa=100, 6 L):  Fsc 63.17 Hz,  Qtc 0.599
  //   Lossless (Ql=Qa=999999):            Fsc 60.32 Hz,  Qtc 0.596
  // The algorithm reproduces these BIT-EXACTLY when fed WinISD's own derived Qts. WinISD
  // derives Qts≈0.3952 for this driver via its Re_eff / voice-coil-temperature convention
  // (SEALED_FSC_MODEL.md §5), NOT the nominal Qts=0.39 from Qms=2.94/Qes=0.45. That derivation
  // is a driver-solver concern separate from the box model.
  describe('Dayton E150HE-44 in 6L sealed — WinISD golden', () => {
    const box = { Fs: 40, Vas: 0.007645536, Vb: 0.006, Ql: 10, Qa: 100 };
    const QTS_WINISD = 0.3952; // WinISD's derived Qts for this driver (Re_eff convention)

    it('reproduces WinISD lossy 63.17 Hz / 0.599 with WinISD-derived Qts', () => {
      const r = sealedResonance(LossMode.WinisdLossy, { ...box, Qts: QTS_WINISD });
      expect(r.Fsc).toBeCloseTo(63.17, 2);
      expect(r.Qtc).toBeCloseTo(0.599, 3);
    });
    it('reproduces WinISD lossless 60.32 Hz / 0.596 with WinISD-derived Qts', () => {
      const r = sealedResonance(LossMode.Lossless, { ...box, Qts: QTS_WINISD });
      expect(r.Fsc).toBeCloseTo(60.32, 2);
      expect(r.Qtc).toBeCloseTo(0.596, 3);
    });
    it('every mode returns a physical resonance, never the 20 kHz impedance-peak artifact', () => {
      for (const q of [0.39, QTS_WINISD]) {
        for (const m of LossMode.ALL) {
          const r = sealedResonance(m, { ...box, Qts: q });
          expect(r.Fsc).toBeGreaterThan(40);
          expect(r.Fsc).toBeLessThan(100); // NOT ~20000
          expect(r.Qtc).toBeGreaterThan(0.4); // NOT 0
        }
      }
    });
  });

  // The exact user-supplied CLI scenario: openisd was silently ignoring the series source
  // resistance Rg (the Signal tab's "Series resistance", state.P.Rs). WinISD folds Rg into the
  // driver's electrical Q — Qes' = Qes·(Re+Rg)/Re — which raises the total Qts and therefore
  // shifts the sealed WinISD-lossy Fsc/Qtc. Golden values are WinISD's own measured readout.
  describe('sourceLoadedQts — Rg folded into the driver Q (the reported bug)', () => {
    const Fs = 40, Vas = 0.00765, Qes = 0.450, Qms = 2.940, Re = 6.6, Rg = 0.1;
    const Vb = 0.006, Ql = 10, Qa = 100;
    const qtsNominal = 1 / (1 / Qms + 1 / Qes); // what openisd used to compute, ignoring Rg

    it('Rg=0 leaves Qts at the nominal (no-source-resistance) value', () => {
      expect(sourceLoadedQts(Qms, Qes, Re, 0, qtsNominal)).toBeCloseTo(qtsNominal, 9);
    });

    it('--fs 40 --vas 7.65 --qes 0.450 --qms 2.940 --re 6.6 --rg 0.1 --vb 6 --ql 10 --qa 100 → Fsc=63.1762Hz Qtc=0.5995', () => {
      const qts = sourceLoadedQts(Qms, Qes, Re, Rg, qtsNominal);
      const r = sealedResonance(LossMode.WinisdLossy, { Fs, Vas, Qts: qts, Vb, Ql, Qa });
      expect(r.Fsc).toBeCloseTo(63.1762, 3);
      expect(r.Qtc).toBeCloseTo(0.5995, 3);
    });

    it('falls back to the nominal Qts when Qms/Qes/Re are unavailable', () => {
      expect(sourceLoadedQts(0, 0, 0, Rg, 0.42)).toBe(0.42);
    });
  });
});
