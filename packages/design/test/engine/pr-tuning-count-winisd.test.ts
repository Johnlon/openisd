/**
 * PrEngine tuning with more than one radiator, against what WinISD 0.7.0.950 displays.
 *
 * Source: winisd_research runs/pr-w5-1/pr_tuning_edit.json (toys/probe_pr_tuning_edit.py,
 * 2026-09-28): W5-1138SMF project, 10 L, radiator Fs 30 Hz / Vas 4.8 L / Sd 95 cm²; after typing
 * the radiator count 2 and Me 0.01 kg the Box pane Fb reads "39.45" (two decimals).
 * bugs/archive/BUG_20260928_pr-system-tuning-ignores-radiator-count.md.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';

const engine = createEngine();
const WINISD_AIR = {rho: 1.2009521771468228, c: 343.68412096215235};
const prCms = 0.0048 / (WINISD_AIR.rho * WINISD_AIR.c ** 2 * 0.0095 ** 2);
const prMmd = 1 / ((2 * Math.PI * 30) ** 2 * prCms);
const BOX = {Vb: 0.01, prMmd, prMadd: 0.01, prSd: 0.0095, prCms, prNum: 2};
const WINISD_FB_DISPLAYED_HZ = 39.45;

describe('PrEngine tuning with two radiators, Me 10 g', () => {
  it('matches the Fb WinISD displays (39.45 Hz, to its two decimals)', () => {
    const fp = engine.pr.tuning(BOX, WINISD_AIR);
    assert.ok(Math.abs(fp - WINISD_FB_DISPLAYED_HZ) < 0.005, `tuning ${fp} Hz, WinISD shows ${WINISD_FB_DISPLAYED_HZ}`);
  });

  it('massForFp inverts it: the per-radiator mass for that tuning is Mmd + Me', () => {
    const fp = engine.pr.tuning(BOX, WINISD_AIR);
    const mass = engine.pr.massForFp(BOX, fp, WINISD_AIR);
    assert.ok(Math.abs(mass - (prMmd + 0.01)) < 1e-15, `mass ${mass}, want ${prMmd + 0.01}`);
  });
});
