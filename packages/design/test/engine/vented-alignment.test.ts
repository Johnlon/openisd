/**
 * `ventedAlignment()` — WinISD's five New-Project-wizard vented alignments.
 *
 * Reference: WinISD's own designer function, decompiled from winisd.exe
 * (winisd_research/GHIDRA_FINDINGS.md "VENTED ALIGNMENT MECHANISM FOUND — 0x46afd0") and
 * validated there against 60 wizard captures (Qts 0.15–1.0) to 2.3e-14. The engine must
 * reproduce those captures to floating-point noise: a percent-level miss is a wrong input, not
 * rounding. WinISD does not clamp: outside ~0.25–0.6 the polynomials are extrapolated as-is
 * (C4 at Qts 1.0 gives 1684 L) and the captures pin that too.
 *
 * Inputs: the SOURCE-LOADED Qts (`sourceLoadedQts` — WinISD folds the project's series
 * resistance Rg into Qes before designing), Vas, Fs, and Ql (read by BB4/SBB4 only).
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {Engine} from '../../engine/index.js';
import {VENTED_ALIGNMENT_OPTIONS} from '../../fields/index.js';
import {
  WINISD_VENTED_ALIGNMENT_CAPTURES, WINISD_VENTED_CAPTURE_DRIVER,
} from '../fixtures/winisdVentedAlignmentCaptures.js';

const engine = new Engine();

/** Double-precision noise budget. The Python validator's worst case over the same 60 runs was
 *  2.3e-14; anything above 1e-12 is a formula or input error. */
const REL_TOL = 1e-12;

function relErr(actual: number, expected: number): number {
  return Math.abs(actual - expected) / Math.abs(expected);
}

describe('ventedAlignment — reproduces WinISD wizard captures', () => {
  const d = WINISD_VENTED_CAPTURE_DRIVER;

  for (const c of WINISD_VENTED_ALIGNMENT_CAPTURES) {
    const qtsNominal = 1 / (1 / c.Qes + 1 / d.Qms);
    it(`${c.alignment} at Qts ${qtsNominal.toFixed(2)} → Vb ${(c.Vb_m3 * 1000).toFixed(2)} L, Fb ${c.Fb_hz.toFixed(2)} Hz`, () => {
      const qtsLoaded = engine.sourceLoadedQts(d.Qms, c.Qes, d.Re_ohm, d.Rg_ohm, qtsNominal);
      const {Vb, Fb} = engine.ventedAlignment(c.alignment, d.Fs_hz, qtsLoaded, d.Vas_m3, d.Ql);
      assert.ok(relErr(Vb, c.Vb_m3) < REL_TOL, `Vb ${Vb} vs WinISD ${c.Vb_m3} (rel ${relErr(Vb, c.Vb_m3)})`);
      assert.ok(relErr(Fb, c.Fb_hz) < REL_TOL, `Fb ${Fb} vs WinISD ${c.Fb_hz} (rel ${relErr(Fb, c.Fb_hz)})`);
    });
  }

  it('the captures cover every alignment the wizard offers', () => {
    const captured = new Set(WINISD_VENTED_ALIGNMENT_CAPTURES.map(c => c.alignment));
    for (const o of VENTED_ALIGNMENT_OPTIONS) assert.ok(captured.has(o.value), `no capture for ${o.value}`);
  });

  it('ignoring Rg is the ~3 % error WinISD does not make', () => {
    const c = WINISD_VENTED_ALIGNMENT_CAPTURES.find(x => x.alignment === 'bb4' && x.Qes === 0.432133);
    assert.ok(c);
    const qtsNominal = 1 / (1 / c.Qes + 1 / d.Qms);
    const {Vb} = engine.ventedAlignment('bb4', d.Fs_hz, qtsNominal, d.Vas_m3, d.Ql);
    assert.ok(relErr(Vb, c.Vb_m3) > 0.02, `unloaded Qts should miss by ~3 %, got rel ${relErr(Vb, c.Vb_m3)}`);
  });
});

describe('ventedAlignment — structure', () => {
  it('BB4/SBB4 tunes the box to Fs regardless of Qts', () => {
    for (const qts of [0.2, 0.3, 0.5, 0.7]) {
      assert.equal(engine.ventedAlignment('bb4', 40, qts, 0.02, 10).Fb, 40);
    }
  });

  it('only BB4/SBB4 reads Ql', () => {
    for (const o of VENTED_ALIGNMENT_OPTIONS) {
      const at7 = engine.ventedAlignment(o.value, 40, 0.39, 0.02, 7);
      const at10 = engine.ventedAlignment(o.value, 40, 0.39, 0.02, 10);
      if (o.value === 'bb4') assert.notEqual(at7.Vb, at10.Vb);
      else assert.deepEqual(at7, at10);
    }
  });

  it('Vb scales with Vas and Fb with Fs', () => {
    for (const o of VENTED_ALIGNMENT_OPTIONS) {
      const a = engine.ventedAlignment(o.value, 40, 0.39, 0.02, 10);
      const b = engine.ventedAlignment(o.value, 80, 0.39, 0.04, 10);
      assert.ok(relErr(b.Vb, 2 * a.Vb) < 1e-12);
      assert.ok(relErr(b.Fb, 2 * a.Fb) < 1e-12);
    }
  });
});

describe('VENTED_ALIGNMENT_OPTIONS — WinISD dropdown', () => {
  it('lists the five alignments in WinISD order with WinISD labels', () => {
    assert.deepEqual(VENTED_ALIGNMENT_OPTIONS.map(o => [o.value, o.label]), [
      ['qb3',  'QB3 Quasi-butterworth'],
      ['bb4',  'BB4/SBB4 (Super-)boom-box'],
      ['c4',   'C4/SC4 (Sub-)Chebyshev'],
      ['ebs3', 'EBS3 extended bass shelf -3 dB'],
      ['ebs6', 'EBS6 extended bass shelf -6 dB'],
    ]);
  });
});
