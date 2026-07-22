/**
 * Transfer function magnitude vs SPL — real bug, not a missing feature. Original's chart
 * menu (`OriginalShell.vue` CHART_ITEMS) offered "Transfer function magnitude" as a distinct
 * chart, but it silently routed to the SAME 'SPL' tab — same series, same absolute dB SPL
 * numbers, no renormalization. A user selecting it got the SPL chart under a different label.
 *
 * WinISD's real behaviour (WINISD.md §17, verified from real WinISD 0.7.0.950 screenshots —
 * identical cursor value in both charts, −9.896 dB at 38.01 Hz): both charts plot the SAME
 * underlying response; "Transfer function magnitude" just renormalizes the Y axis so 0 dB =
 * the passband output level, with a dashed −3 dB reference line. It is a DISPLAY MODE derived
 * from the same sweep data — not a new engine computation (sweep.ts is untouched; only
 * series.ts's presentation layer gains a branch).
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { deriveDriver, sweep } from '@openisd/engine';
import type { SweepParams } from '@openisd/engine';
import { seriesFor } from '../src/utils/series.js';
import type { MaxCurvesResult } from '@openisd/engine';

const RAW = { Fs: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas: 0.0300, Sd: 0.0133, Re: 5.6, Le: 0.70e-3, Xmax: 0.0050, Pe: 60, Z: 8 };
const { value: DRV } = deriveDriver(RAW);
if (!DRV) throw new Error('Test fixture invalid: driver failed to derive');

const P: SweepParams = { Vb: 0.020, eg: Math.sqrt(1 * RAW.Re), fmin: 1, fmax: 200, N: 100, Ql: 10, Qa: 100, Qp: 100 };
const SW = sweep(DRV, 'sealed', P);
// Neither SPL nor TFMag reads mx (MaxCurvesResult) — only the MaxSPL/MaxPwr tabs do.
const MX: MaxCurvesResult = { fs: SW.fs, maxspl: [], maxpwr: [], xlim: [], peAbsent: true };

describe('seriesFor("TFMag") — a real distinct chart, not SPL relabelled', () => {
  it('is NOT the same numbers as the SPL series (the confirmed bug)', () => {
    const spl = seriesFor('SPL', DRV, 'sealed', P, SW, MX);
    const tf = seriesFor('TFMag', DRV, 'sealed', P, SW, MX);
    const splYs = spl.series.find(s => s.name === 'SPL')!.ys;
    const tfYs = tf.series.find(s => s.name === 'Transfer function')!.ys;
    assert.notDeepEqual(tfYs, splYs, 'Transfer function magnitude must differ from raw SPL — it failed identically before this fix');
  });

  it('is the SAME curve SHAPE as SPL, offset by exactly the passband reference (WINISD.md §17)', () => {
    const spl = seriesFor('SPL', DRV, 'sealed', P, SW, MX);
    const tf = seriesFor('TFMag', DRV, 'sealed', P, SW, MX);
    const splYs = spl.series.find(s => s.name === 'SPL')!.ys;
    const tfYs = tf.series.find(s => s.name === 'Transfer function')!.ys;
    const real = splYs.filter(v => Number.isFinite(v) && v > -190);
    const ref = Math.max(...real);
    for (let i = 0; i < splYs.length; i++) {
      if (!(splYs[i] > -190)) continue; // skip the -200 "no output" sentinel
      assert.ok(Math.abs(tfYs[i] - (splYs[i] - ref)) < 1e-9,
        `at fs[${i}]=${SW.fs[i].toFixed(1)}Hz: TF=${tfYs[i]} should equal SPL-ref=${splYs[i] - ref}`);
    }
  });

  it('peaks at (or just under) 0 dB — the passband reference IS the renormalization target', () => {
    const tf = seriesFor('TFMag', DRV, 'sealed', P, SW, MX);
    const tfYs = tf.series.find(s => s.name === 'Transfer function')!.ys;
    const real = tfYs.filter(v => Number.isFinite(v) && v > -190);
    assert.ok(Math.max(...real) <= 1e-9, `peak must be ≤ 0 dB after renormalization, got ${Math.max(...real)}`);
    assert.ok(Math.max(...real) > -1, `peak must be essentially AT 0 dB somewhere in the sweep, got ${Math.max(...real)}`);
  });

  it('draws the defining 0 dB and −3 dB dashed reference lines (WinISD always shows both)', () => {
    const tf = seriesFor('TFMag', DRV, 'sealed', P, SW, MX);
    const zero = tf.series.find(s => s.name === '0 dB');
    const minus3 = tf.series.find(s => s.name === '−3 dB');
    assert.ok(zero, '0 dB reference line must be present');
    assert.ok(minus3, '−3 dB reference line must be present');
    assert.ok(zero!.dash, '0 dB line is dashed');
    assert.ok(minus3!.dash, '−3 dB line is dashed');
    assert.ok(zero!.ys.every(v => v === 0));
    assert.ok(minus3!.ys.every(v => v === -3));
  });
});
