/**
 * The WinISD oracle values are WinISD Pro 0.7.0.950's own `[Box] Fr` readout, captured by
 * reverse-engineering + live gdb capture (research repo SEALED_FSC_MODEL.md §4). The reference
 * driver is Fs=40, Vas=7.47 L, with the Qts WinISD derives for it (0.395643).
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  LossMode,
  sealedResonance,
  sealedResonanceWinisd,
  sealedFscWinisd,
  sourceLoadedQts,
} from '../src/lossMode.js';

const DRIVER = { Fs: 40, Vas: 0.00747, Qts: 0.395643 };
const p = (Vb: number, Ql: number, Qa = 10000) => ({ ...DRIVER, Vb, Ql, Qa });

/** |got − want| < 10^−digits / 2 — the same window vitest's toBeCloseTo(want, digits) uses. */
function closeTo(got: number, want: number, digits: number, msg: string) {
  const tol = Math.pow(10, -digits) / 2;
  assert.ok(Math.abs(got - want) < tol,
    `${msg}: got ${got}, expected ${want} ±${tol}`);
}

describe('Sealed-Box Resonance Loss Models', () => {
  describe('WinisdLossy — bit-exact to WinISD readout', () => {
    // WinISD [Box] Fr at Vb=6 L, QA=10000, over the QL sweep (SEALED_FSC_MODEL.md §6).
    const oracle: [number, number][] = [
      [2, 74.60915], [5, 65.73862], [10, 62.79619], [20, 61.35111], [100, 60.21429],
    ];
    for (const [Ql, fr] of oracle) {
      it(`Vb=6L Ql=${Ql} → ${fr} Hz`, () => {
        closeTo(sealedFscWinisd(p(0.006, Ql)), fr, 4, `Fsc at Ql=${Ql}`);
      });
    }
    // Other volumes at Ql=10 (same driver) — from the oracle grid.
    it('tracks volume at Ql=10 (10L, 20L, 40L)', () => {
      closeTo(sealedFscWinisd(p(0.010, 10)), 55.14994, 3, 'Fsc at 10 L');
      closeTo(sealedFscWinisd(p(0.020, 10)), 48.40568, 3, 'Fsc at 20 L');
      closeTo(sealedFscWinisd(p(0.040, 10)), 44.50218, 3, 'Fsc at 40 L');
    });
  });

  describe('WinisdLossy converges to lossless as leakage vanishes', () => {
    it('Ql→∞ equals fs·√(1+Vas/Vb)', () => {
      const lossless = 40 * Math.sqrt(1 + 0.00747 / 0.006);
      closeTo(sealedFscWinisd(p(0.006, 1e9)), lossless, 6, 'Fsc at Ql=1e9');
    });
    it('resonance rises monotonically as Ql falls', () => {
      const f = (Ql: number) => sealedFscWinisd(p(0.006, Ql));
      assert.ok(f(2) > f(5), 'Ql=2 must resonate above Ql=5');
      assert.ok(f(5) > f(10), 'Ql=5 must resonate above Ql=10');
      assert.ok(f(10) > f(100), 'Ql=10 must resonate above Ql=100');
    });
  });

  // Direct tests of the pole solver itself. sealedFscWinisd and sealedResonance(WinisdLossy)
  // both delegate here, so this is where the Qtc half of the readout and the two internal
  // branches (complex pole pair vs the overdamped real-root fallback) are exercised head-on.
  describe('sealedResonanceWinisd — the lossy pole solver, direct', () => {
    it('returns the same Fsc that sealedFscWinisd projects out of it', () => {
      // sealedFscWinisd is documented as "the pole frequency alone" — assert the delegation
      // rather than assume it, since a divergence would silently split the Box tab readout.
      for (const Ql of [2, 10, 100]) {
        assert.equal(sealedResonanceWinisd(p(0.006, Ql)).Fsc, sealedFscWinisd(p(0.006, Ql)),
          `Fsc must match sealedFscWinisd at Ql=${Ql}`);
      }
    });

    it('is the mode WinisdLossy dispatches to', () => {
      const direct = sealedResonanceWinisd(p(0.006, 10, 100));
      const viaMode = sealedResonance(LossMode.WinisdLossy, p(0.006, 10, 100));
      assert.deepEqual(viaMode, direct, 'WinisdLossy must be exactly this function');
    });

    it('short-circuits to the lossless closed form when there is no leakage', () => {
      // Ql ≥ 1e6 (or non-positive) means "no leak", and the answer is then the textbook
      // Fc = Fs·√(1+Vas/Vb), Qtc = Qts·√(1+Vas/Vb) with no root-finding at all.
      const ratio = Math.sqrt(1 + 0.00747 / 0.006);
      for (const Ql of [1e6, 1e9, 0, -5]) {
        const r = sealedResonanceWinisd(p(0.006, Ql));
        closeTo(r.Fsc, 40 * ratio, 9, `Fsc for Ql=${Ql}`);
        closeTo(r.Qtc, 0.395643 * ratio, 9, `Qtc for Ql=${Ql}`);
      }
    });

    it('treats a non-positive or effectively-infinite Qa as no absorption loss', () => {
      // Qa ≤ 0 and Qa ≥ 1e6 both collapse to the same "no damping material" case.
      const base = sealedResonanceWinisd(p(0.006, 10, 1e9));
      for (const Qa of [0, -1, 1e6, 1e12]) {
        assert.deepEqual(sealedResonanceWinisd(p(0.006, 10, Qa)), base,
          `Qa=${Qa} must read as no absorption loss`);
      }
    });

    it('adding absorption loss lowers Q without moving resonance much', () => {
      const light = sealedResonanceWinisd(p(0.006, 10, 10000));
      const heavy = sealedResonanceWinisd(p(0.006, 10, 20));
      assert.ok(heavy.Qtc < light.Qtc, 'stuffing must damp the system Q');
      assert.ok(Math.abs(heavy.Fsc - light.Fsc) / light.Fsc < 0.05,
        'absorption is a damping term — it must not shift Fsc by more than a few percent');
    });

    it('stays continuous through the overdamped/underdamped seam (Ql 0.1 → 10)', () => {
      // Below roughly Ql = 0.33 the cubic has three REAL roots, so the complex-pole formula
      // has nothing to grab and the two dominant real roots stand in for the pair. That
      // fallback is only correct if it agrees with the pole-pair branch at the crossover —
      // a wrong fallback shows up as a step in an otherwise smooth curve.
      let prev: { Fsc: number; Qtc: number } | null = null;
      let sawOverdamped = false, sawUnderdamped = false;
      for (let i = 0; i <= 40; i++) {
        const Ql = 0.1 * Math.pow(10, i / 20); // log grid, 0.1 → 10
        const r = sealedResonanceWinisd(p(0.006, Ql));
        assert.ok(Number.isFinite(r.Fsc) && r.Fsc > 0, `Fsc must be a real frequency at Ql=${Ql}`);
        assert.ok(Number.isFinite(r.Qtc) && r.Qtc > 0, `Qtc must be positive at Ql=${Ql}`);
        // Qtc = √(r0·r1)/(r0+r1) ≤ ½ by AM–GM, so a Qtc above ½ can only come from a
        // genuine complex pole pair — which is how both branches are shown to be visited.
        if (r.Qtc <= 0.5) sawOverdamped = true; else sawUnderdamped = true;
        if (prev) {
          assert.ok(r.Fsc < prev.Fsc, `Fsc must fall as Ql rises (at Ql=${Ql})`);
          assert.ok((prev.Fsc - r.Fsc) / prev.Fsc < 0.10,
            `no step in Fsc across the seam at Ql=${Ql}: ${prev.Fsc} → ${r.Fsc}`);
        }
        prev = r;
      }
      assert.ok(sawOverdamped, 'the grid must reach the overdamped real-root branch');
      assert.ok(sawUnderdamped, 'the grid must reach the complex-pole branch');
    });
  });

  describe('Lossless mode = textbook sealed resonance', () => {
    it('Fsc = fs·√(1+Vas/Vb), independent of Ql/Qa', () => {
      const r1 = sealedResonance(LossMode.Lossless, p(0.006, 10));
      const r2 = sealedResonance(LossMode.Lossless, p(0.006, 2));
      const expected = 40 * Math.sqrt(1 + 0.00747 / 0.006);
      closeTo(r1.Fsc, expected, 9, 'Fsc at Ql=10');
      closeTo(r2.Fsc, expected, 9, 'Fsc at Ql=2 — Ql does not move it');
      closeTo(r1.Qtc, 0.395643 * Math.sqrt(1 + 0.00747 / 0.006), 9, 'Qtc');
    });
  });

  describe('ConventionalLossy keeps fc fixed, folds losses into Q', () => {
    it('Fsc equals lossless; Qtc combines 1/Qtc + 1/Ql + 1/Qa', () => {
      const r = sealedResonance(LossMode.ConventionalLossy, p(0.006, 10, 100));
      const lossless = 40 * Math.sqrt(1 + 0.00747 / 0.006);
      const qtcLossless = 0.395643 * Math.sqrt(1 + 0.00747 / 0.006);
      closeTo(r.Fsc, lossless, 9, 'Fsc — frequency unchanged');
      closeTo(r.Qtc, 1 / (1 / qtcLossless + 1 / 10 + 1 / 100), 9, 'Qtc');
    });
  });

  describe('LossMode enum', () => {
    it('has exactly three members with WinISD as default', () => {
      assert.deepEqual(LossMode.ALL.map(m => m.value),
        ['lossless', 'conventional-lossy', 'winisd-lossy']);
      assert.equal(LossMode.Default, LossMode.WinisdLossy);
    });
    it('parses wire values and falls back to the default', () => {
      assert.equal(LossMode.parse('lossless'), LossMode.Lossless);
      assert.equal(LossMode.parse('winisd-lossy'), LossMode.WinisdLossy);
      assert.equal(LossMode.parse('nonsense'), LossMode.Default);
      assert.equal(LossMode.parse(null), LossMode.Default);
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
      closeTo(r.Fsc, 63.17, 2, 'Fsc');
      closeTo(r.Qtc, 0.599, 3, 'Qtc');
    });
    it('reproduces WinISD lossless 60.32 Hz / 0.596 with WinISD-derived Qts', () => {
      const r = sealedResonance(LossMode.Lossless, { ...box, Qts: QTS_WINISD });
      closeTo(r.Fsc, 60.32, 2, 'Fsc');
      closeTo(r.Qtc, 0.596, 3, 'Qtc');
    });
    it('every mode returns a physical resonance, never the 20 kHz impedance-peak artifact', () => {
      for (const q of [0.39, QTS_WINISD]) {
        for (const m of LossMode.ALL) {
          const r = sealedResonance(m, { ...box, Qts: q });
          assert.ok(r.Fsc > 40, `${m.value} Fsc must exceed Fs (Qts=${q})`);
          assert.ok(r.Fsc < 100, `${m.value} Fsc must not be the ~20 kHz artifact (Qts=${q})`);
          assert.ok(r.Qtc > 0.4, `${m.value} Qtc must not collapse to 0 (Qts=${q})`);
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
      closeTo(sourceLoadedQts(Qms, Qes, Re, 0, qtsNominal), qtsNominal, 9, 'Qts at Rg=0');
    });

    it('--fs 40 --vas 7.65 --qes 0.450 --qms 2.940 --re 6.6 --rg 0.1 --vb 6 --ql 10 --qa 100 → Fsc=63.1762Hz Qtc=0.5995', () => {
      const qts = sourceLoadedQts(Qms, Qes, Re, Rg, qtsNominal);
      const r = sealedResonance(LossMode.WinisdLossy, { Fs, Vas, Qts: qts, Vb, Ql, Qa });
      closeTo(r.Fsc, 63.1762, 3, 'Fsc');
      closeTo(r.Qtc, 0.5995, 3, 'Qtc');
    });

    it('falls back to the nominal Qts when Qms/Qes/Re are unavailable', () => {
      assert.equal(sourceLoadedQts(0, 0, 0, Rg, 0.42), 0.42);
    });
  });
});
