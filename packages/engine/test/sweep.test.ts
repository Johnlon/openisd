/**
 * Unit tests for src/core/sweep.js — targeting the branch coverage gaps
 * not covered by engine.test.mjs:
 *   - Line 53: fmin/fmax/N parameter defaults (10, 1000, 400)
 *   - Line 70: spl fallback to -200 when pm = 0 (eg = 0 → no acoustic output)
 *   - Line 85: group-delay dw = 0 fallback (N = 0 → single frequency point)
 *   - Line 98: drv.Pe default to 50 W in maxCurves when Pe absent
 *
 * Note on line 103 (excAt283 = 0 → vXmax = 1e9):
 *   excAt283 = |UD|·√2 / (ω·Sd) at 2.83 V. Since UD = pg / (ZaE+ZaD+Zbox) and pg ≠ 0
 *   when eg = 2.83 V, excAt283 = 0 is unreachable in practice — the guard is defensive.
 *   This branch is intentionally left uncovered with this explanation.
 *
 * Run: node --test test/sweep.test.mjs
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { sweep, maxCurves } from '@resonate/engine';
import { deriveDriver } from '@resonate/engine';

// Reference driver: same synthetic 6.5" mid-woofer as engine.test.mjs
const { value: DRV, errors: _drvErrors } = deriveDriver({
  Fs:   37,      // Hz
  Qts:  0.38,
  Qes:  0.40,
  Qms:  7.0,
  Vas:  0.030,   // m³
  Sd:   0.0133,  // m²
  Re:   5.6,     // Ω
  Le:   0.7e-3,  // H
  Xmax: 0.005,   // m
  Pe:   60,      // W
  Z:    8,       // Ω
});
if (!DRV) throw new Error('Test fixture driver is invalid: ' + _drvErrors.filter(e => e.level === 'error').map(e => `${e.field}: ${e.message}`).join('; '));

// Sealed box — lossless, 30 L
const BOX = 'sealed';
const VB_M3 = 0.030;
const QL_LOSSLESS = 1e6;

// Default parameter values from sweep.js line 53
const DEFAULT_FMIN_HZ = 10;
const DEFAULT_FMAX_HZ = 1000;
const DEFAULT_N = 400;       // number of frequency steps → N+1 = 401 points

// 2.83 V — IEC 60268-5 sensitivity reference
const EG_STANDARD = 2.83;

// ── Line 53: fmin / fmax / N defaults ────────────────────────────────────────

describe('sweep — parameter defaults when fmin / fmax / N are absent', () => {
  it('uses fmin=10 Hz, fmax=1000 Hz, N=400 when those parameters are not supplied — '
   + 'verifies P.fmin||10, P.fmax||1000, P.N||400 fallbacks', () => {
    // Call sweep without fmin, fmax, or N.  The returned fs array must span 10–1000 Hz
    // with 401 points (steps 0…400 inclusive).
    const { fs } = sweep(DRV, BOX, { Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD });

    // N+1 = 401 points
    assert.equal(fs.length, DEFAULT_N + 1,
      `expected ${DEFAULT_N + 1} frequency points (N=${DEFAULT_N} steps + 1), got ${fs.length}`);

    // First frequency must equal fmin exactly (no log-space rounding at i=0)
    assert.equal(fs[0], DEFAULT_FMIN_HZ,
      `first frequency must be fmin=${DEFAULT_FMIN_HZ} Hz, got ${fs[0]}`);

    // Last frequency must equal fmax exactly (at i=N: f0*(f1/f0)^1 = f1)
    assert.equal(fs[fs.length - 1], DEFAULT_FMAX_HZ,
      `last frequency must be fmax=${DEFAULT_FMAX_HZ} Hz, got ${fs[fs.length - 1]}`);
  });
});

// ── Line 70: pm = 0 → spl fallback to -200 ───────────────────────────────────

describe('sweep — zero-excitation (eg=0) produces -200 dB SPL for all frequencies', () => {
  it('when eg=0 there is no acoustic output; spl fallback (-200 dB) applies at every point', () => {
    // With eg=0: pg = cx(0·Bl, 0) = cx(0,0) → UD = 0 → U0 = 0 → pm = |Hc| = 0.
    // The guard `pm > 0 ? 20·log10(pm/P0) : -200` takes the -200 branch.
    const SPL_SILENCE_DB = -200;  // sentinel value for zero-excitation, defined in sweep.js
    const { spl } = sweep(DRV, BOX, { Vb: VB_M3, Ql: QL_LOSSLESS, eg: 0 });
    assert(spl.length > 0, 'spl array must be non-empty');
    for (let i = 0; i < spl.length; i++) {
      assert.equal(spl[i], SPL_SILENCE_DB,
        `spl[${i}] must be ${SPL_SILENCE_DB} dB with eg=0, got ${spl[i]}`);
    }
  });
});

// ── Line 85: dw = 0 → group delay fallback to 0 ──────────────────────────────

describe('sweep — fmin=fmax produces constant-frequency sweep where dw=0', () => {
  it('when fmin equals fmax all frequencies are identical so dw=0 and group delay defaults to 0 ms '
   + 'for every sample — exercises the dw!==0 false branch', () => {
    // P.N || 400: 0 is falsy so N=0 would use default 400.  Instead, trigger dw=0 by
    // making fmin = fmax so that f = fmin·(fmax/fmin)^(i/N) = fmin for all i.
    // Then fs[b] - fs[a] = 0 → dw = 0 → gd.push(0) for every sample.
    const FREQ_HZ = 100;      // arbitrary passband frequency
    const N_STEPS = 5;        // need >1 so the loop has multiple iterations
    const GD_ZERO_MS = 0;     // fallback group delay when dw=0

    const { fs, gd } = sweep(DRV, BOX, {
      Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD,
      fmin: FREQ_HZ, fmax: FREQ_HZ, N: N_STEPS,
    });

    // All frequencies must be identical (fmin = fmax collapse to one point)
    assert(fs.every(f => f === FREQ_HZ),
      `all frequencies must equal ${FREQ_HZ} Hz when fmin=fmax`);

    // All group delay values must be the dw=0 fallback
    for (let i = 0; i < gd.length; i++) {
      assert.equal(gd[i], GD_ZERO_MS,
        `gd[${i}] must be ${GD_ZERO_MS} ms when dw=0, got ${gd[i]}`);
    }
  });
});

// ── Line 98: drv.Pe default in maxCurves ──────────────────────────────────────

describe('maxCurves — one limit absent falls back to the other (never poisons the curve)', () => {
  it('driver without Pe → curve is Xmax-limited and finite (no thermal limit, no fabricated default)', () => {
    // Pe absent → vPe = Infinity; the excursion (Xmax) limit alone bounds the curve.
    const { value: drvNoPe, errors: _noPeErrors } = deriveDriver({
      Fs: 37, Qts: 0.38, Qes: 0.40, Qms: 7.0,
      Vas: 0.030, Sd: 0.0133, Re: 5.6, Le: 0.7e-3, Xmax: 0.005,
      // Pe intentionally absent — deriveDriver returns warn (not error); Xmax-limited max curves
    });
    if (!drvNoPe) throw new Error('Test fixture invalid: ' + _noPeErrors.filter(e => e.level === 'error').map(e => `${e.field}: ${e.message}`).join('; '));

    const { fs, maxspl } = maxCurves(drvNoPe, BOX, {
      Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD, fmin: 10, fmax: 1000, N: 50,
    });

    assert(fs.length > 0, 'maxCurves must return non-empty fs array');
    assert(maxspl.every(v => isFinite(v)),
      'every maxspl value must be finite when Pe is absent (Xmax-limited)');

    // Physically plausible passband range.
    const passband = maxspl.find((_, i) => fs[i] > 200);  // well above Fs=37
    assert(passband !== undefined && passband > 60 && passband < 160,
      `passband maxspl must be in [60, 160] dB, got ${passband} dB`);
  });

  it('driver with Xmax=0 but Pe present → curve is Pe-limited and finite, not -Infinity', () => {
    // Regression: Xmax=0 used to make vXmax=0 → vUse=0 → maxspl=-Infinity, maxpwr=0
    // (blank Max-SPL/Max-power charts). Xmax=0 must be treated as "no excursion limit"
    // so the Pe (thermal) limit alone bounds the curve.
    const { value: drvXmax0, errors: _e } = deriveDriver({
      Fs: 37, Qts: 0.38, Qes: 0.40, Qms: 7.0,
      Vas: 0.030, Sd: 0.0133, Re: 5.6, Le: 0.7e-3, Pe: 60, Xmax: 0,
    });
    if (!drvXmax0) throw new Error('Test fixture invalid: ' + _e.filter(e => e.level === 'error').map(e => `${e.field}: ${e.message}`).join('; '));

    const { maxspl, maxpwr } = maxCurves(drvXmax0, BOX, {
      Vb: VB_M3, Ql: QL_LOSSLESS, eg: EG_STANDARD, fmin: 10, fmax: 1000, N: 50,
    });

    assert(maxspl.every(Number.isFinite),
      'Xmax=0 must not poison Max-SPL with -Infinity — Pe limit must apply');
    assert(maxpwr.every(v => Number.isFinite(v) && v > 0),
      'Max-power must be finite and positive (Pe-limited), not 0');
  });
});
