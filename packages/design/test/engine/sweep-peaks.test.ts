/**
 * `SimulationEngine.peaks(sw)`: the largest port air speed and cone excursion in a sweep, and the
 * frequency each happens at. Specified in DESKTOP_TUNE_BUILD_SPEC.md G2/G3/G4.
 *
 * Golden data: the WinISD capture `fixtures/winisd-edit-captures/w5/vented-load-endcorr0732.json`
 * (run sweep-t429-w5-vented-load-endcorr0732: W5-1138SMF vented, end correction 0.732, WinISD's
 * Excursion, Rear-port-velocity and SPL charts, every 16th point of a 2085-point 1 Hz-20 kHz sweep).
 * The sweep is cut to the captured indices so both sides see the same points.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/Engine.js';
import type {SweepResult} from '../../engine/types.js';
import {assertLoadParity, loadBase, loadLoadCapture, sweepAfterEdit, type ChartPoint, type Quantity} from '../fixtures/winisdEditCapture.js';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const engine = createEngine();

const capture = loadLoadCapture('w5', 'vented-load-endcorr0732');
const project = loadBase(capture);
assertLoadParity(project, capture);
const swept = sweepAfterEdit(project, capture).sw;

/** A sweep with the given frequencies, port speeds and excursions; every other curve is the real vented one's. */
function sweepOf(fs: number[], pv: number[], exc: number[]): SweepResult {
  return {...swept, fs, pv, exc};
}

describe('peaks: hand-built sweeps', () => {
  const fs = [10, 20, 30, 40];

  it('reads the largest speed and the largest excursion (mm to m) with the frequency of each', () => {
    const p = engine.simulation.peaks(sweepOf(fs, [1, 7, 3, 2], [2, 4, 12, 1]));
    assert.deepEqual(p, {ventSpeed_m_per_s: 7, excursion_m: 0.012, atVentSpeed_hz: 20, atExcursion_hz: 30});
  });

  it('a port speed that is zero everywhere (no port) is null, the excursion still reads', () => {
    const p = engine.simulation.peaks(sweepOf(fs, [0, 0, 0, 0], [2, 4, 12, 1]));
    assert.equal(p.ventSpeed_m_per_s, null);
    assert.equal(p.atVentSpeed_hz, null);
    assert.equal(p.excursion_m, 0.012);
  });

  it('skips points that are not finite', () => {
    const p = engine.simulation.peaks(sweepOf(fs, [1, NaN, 5, Infinity], [NaN, 3, Infinity, 2]));
    assert.deepEqual(p, {ventSpeed_m_per_s: 5, excursion_m: 0.003, atVentSpeed_hz: 30, atExcursion_hz: 20});
  });

  it('is all null when no point is finite, and when the sweep is empty', () => {
    const none = {ventSpeed_m_per_s: null, excursion_m: null, atVentSpeed_hz: null, atExcursion_hz: null};
    assert.deepEqual(engine.simulation.peaks(sweepOf([10, 20], [NaN, NaN], [NaN, NaN])), none);
    assert.deepEqual(engine.simulation.peaks(sweepOf([], [], [])), none);
  });

  it('a first point that ties the maximum keeps its own frequency', () => {
    const p = engine.simulation.peaks(sweepOf(fs, [5, 5, 1, 1], [3, 3, 1, 1]));
    assert.equal(p.atVentSpeed_hz, 10);
    assert.equal(p.atExcursion_hz, 10);
  });
});

describe('peaks: sealed box has no port', () => {
  it('a real sealed sweep gives ventSpeed null and a finite excursion', () => {
    // winisd/fixtures/sealed-w5-flatresponse.wpr: W5-1138SMF in a sealed box.
    const text = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'winisd', 'fixtures', 'sealed-w5-flatresponse.wpr'), 'utf8');
    const project = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text).value!;
    const sw = project.sweep({fmin: 10, fmax: 1000, N: 100}).values!;
    const p = project.peaks(sw);
    assert.equal(p.ventSpeed_m_per_s, null);
    assert.ok(p.excursion_m !== null && p.excursion_m > 0);
  });
});

describe('peaks: vented W5-1138SMF against WinISD (vented-load-endcorr0732)', () => {
  /** The sweep cut to WinISD's captured points. */
  const index = (q: Quantity): readonly ChartPoint[] => capture.charts.get(q)!;
  const cut = (pts: readonly ChartPoint[], from: number[]): number[] => pts.map((c) => from[c.i]!);
  const sampled: SweepResult = {
    ...swept,
    fs: cut(index('excursion'), swept.fs),
    exc: cut(index('excursion'), swept.exc),
    pv: cut(index('rearportvelocity'), swept.pv),
    spl: cut(index('spl'), swept.spl),
  };
  const maxOf = (pts: readonly ChartPoint[]): ChartPoint => pts.reduce((a, b) => (b.v > a.v ? b : a));

  it('peak port speed and its frequency are the maximum of WinISD\'s Rear port velocity chart', () => {
    const want = maxOf(index('rearportvelocity'));
    const got = project.peaks(sampled);
    assert.ok(got.ventSpeed_m_per_s !== null);
    assert.ok(Math.abs(got.ventSpeed_m_per_s - want.v) <= 1e-9 * want.v, `speed ${got.ventSpeed_m_per_s} vs WinISD ${want.v}`);
    assert.equal(got.atVentSpeed_hz, want.f);
  });

  it('peak excursion and its frequency are the maximum of WinISD\'s Excursion chart (mm there, m here)', () => {
    const want = maxOf(index('excursion'));
    const got = project.peaks(sampled);
    assert.ok(got.excursion_m !== null);
    assert.ok(Math.abs(got.excursion_m * 1000 - want.v) <= 1e-9 * want.v, `excursion ${got.excursion_m * 1000} mm vs WinISD ${want.v}`);
    assert.equal(got.atExcursion_hz, want.f);
  });

  it('the full-resolution sweep peak is at least the sampled one and within 5 % of it', () => {
    const full = project.peaks(swept);
    const part = project.peaks(sampled);
    assert.ok(full.ventSpeed_m_per_s! >= part.ventSpeed_m_per_s!);
    assert.ok(full.excursion_m! >= part.excursion_m!);
    assert.ok(full.ventSpeed_m_per_s! <= part.ventSpeed_m_per_s! * 1.05);
    assert.ok(full.excursion_m! <= part.excursion_m! * 1.05);
  });

  it('F3 and F10 of the vented sweep are the first frequencies within 3 and 10 dB of the top of WinISD\'s SPL chart', () => {
    const spl = index('spl');
    const top = maxOf(spl).v;
    const firstWithin = (drop: number): number => spl.find((c) => c.v >= top - drop)!.f;
    assert.equal(project.rolloffFreq(sampled, 3), firstWithin(3));
    assert.equal(project.rolloffFreq(sampled, 10), firstWithin(10));
    assert.ok(firstWithin(10) < firstWithin(3), 'F10 is lower than F3');
  });
});
