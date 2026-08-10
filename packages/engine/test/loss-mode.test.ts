/**
 * Specification: http://localhost:8000/winisd/openisd/openspec/specs/core-engine/spec.md?html
 * Requirement: "Sealed-Box Resonance Loss Models"
 *
 * The WinISD oracle values are WinISD Pro 0.7.0.950's own `[Box] Fr` readout, captured by
 * reverse-engineering + live gdb capture (research repo SEALED_FSC_MODEL.md §4). The reference
 * driver is Fs=40, Vas=7.47 L, with the Qts WinISD derives for it (0.395643).
 */
import { describe, it, expect } from 'vitest';
import { LossMode, sealedResonance, sealedFscWinisd } from '../src/lossMode.js';

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
});
