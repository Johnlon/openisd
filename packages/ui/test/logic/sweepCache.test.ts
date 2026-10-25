/**
 * `SweepCache` — each project's last sweep, re-run only when that project's sweep job changes. The
 * chart overlays read it for every open project on every edit of the focused one; a project that
 * did not change must not be swept again (a held spinner otherwise re-swept every overlay per step).
 */
import {describe, expect, it, vi} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder, type FrequencyGrid} from '@openisd/design';
import {SweepComputer} from '../../src/logic/sweepRequest.js';
import {SweepCache} from '../../src/logic/sweepCache.js';

const GRID: FrequencyGrid = { fmin: 10, fmax: 1000 };
const engine = createEngine();

function project() {
  const p = ProjectBuilder.empty(engine);
  const s = p.driver.specs;
  s.Fs_hz.set(37); s.Qts.set(0.378); s.Qes.set(0.40); s.Qms.set(7.0); s.Vas_m3.set(0.03);
  s.Sd_m2.set(0.0133); s.Re_ohm.set(5.6); s.Le_H.set(0.7e-3); s.Xmax_m.set(0.005); s.Pe_W.set(60);
  p.box.boxType.set('sealed');
  p.box.sealed.volume_m3.set(0.03);
  return p;
}

function setup() {
  const computer = new SweepComputer(engine.simulation);
  const run = vi.spyOn(computer, 'run');
  return { cache: new SweepCache(computer), run };
}

describe('SweepCache', () => {
  it('gives what the project sweep and max curves give', () => {
    const { cache } = setup();
    const p = project();
    const got = cache.sweep(p, GRID);
    expect(got?.sweep).toEqual(p.sweep(GRID));
    expect(got?.max).toEqual(p.maxCurves(GRID));
  });

  it('an unchanged project is not swept again', () => {
    const { cache, run } = setup();
    const p = project();
    const first = cache.sweep(p, GRID);
    const second = cache.sweep(p, GRID);
    expect(run).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('a change to the project, or to the grid, sweeps again', () => {
    const { cache, run } = setup();
    const p = project();
    cache.sweep(p, GRID);
    p.box.sealed.volume_m3.set(0.05);
    cache.sweep(p, GRID);
    cache.sweep(p, { fmin: 20, fmax: 1000 });
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('projects are cached separately', () => {
    const { cache, run } = setup();
    const a = project(), b = project();
    cache.sweep(a, GRID); cache.sweep(b, GRID); cache.sweep(a, GRID); cache.sweep(b, GRID);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('a project the sweep cannot run gives null', () => {
    const { cache } = setup();
    const p = project();
    // A vented port with neither a stated tuning nor a stated length (project-sweep-guards.test.ts):
    // clearing the tuning keeps a length that has a value (John, 2026-10-16), so the volume is cleared
    // first and the length has none; the pair is left blank.
    p.box.boxType.set('vented');
    const vas = p.driver.specs.Vas_m3.value;
    const vb = p.box.vented.volume_m3.value;
    p.driver.specs.Vas_m3.clear();
    p.box.vented.volume_m3.clear();
    p.box.vented.tuning_goal_hz.clear();
    if (vas !== null) p.driver.specs.Vas_m3.set(vas);
    if (vb !== null) p.box.vented.volume_m3.set(vb);
    p.box.vented.vent.shape.set('round');
    p.box.vented.vent.diameter_m.set(0.1);
    expect(cache.sweep(p, GRID)).toBeNull();
  });
});
