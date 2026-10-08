/**
 * Every chart `chartsFor` lists for a 6th-order bandpass or ABC box draws from a freshly built
 * project's sweep: the sweep is non-null and each chart's series holds finite points (plan
 * PLAN_20261007_bp6_abc_complete.md step 11).
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';
import {ProjectBuilder} from '../../domain/index.js';
import {seriesFor} from '../../chart/index.js';
import {driverFrom, whatIfSpec} from '../fixtures/domainBuilders.js';

const engine = createEngine();
const GRID = {fmin: 10, fmax: 2000, N: 100};

for (const type of ['bandpass6', 'abc'] as const) {
  describe(`${type}: a built project's sweep draws every listed chart`, () => {
    const driver = driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: whatIfSpec({Fs_hz: 37, Vas_m3: 0.03, Qes: 0.4, Qms: 7, Re_ohm: 5.6}),
    });
    const b = new ProjectBuilder(driver, engine);
    const project = (type === 'bandpass6' ? b.bandpass6() : b.abc()).build();
    const w = project.driver.specs;
    w.Sd_m2.set(0.0133); w.Le_H.set(0.7e-3); w.Xmax_m.set(0.005); w.Pe_W.set(60);
    const sweep = project.sweep(GRID);
    const max = project.maxCurves(GRID);

    it('the sweep and max curves are not null', () => {
      assert.ok(sweep.values, JSON.stringify(sweep.issues));
      assert.ok(max.values, JSON.stringify(max.issues));
    });

    for (const id of engine.box.chartsFor(type)) {
      it(`${id} has finite plotted points`, () => {
        assert.ok(sweep.values && max.values);
        const bundle = seriesFor(engine, id, project.driver.specs.sweepDriver(), type, GRID, sweep.values, max.values);
        const s = bundle.series.find(x => !x.phantom);
        assert.ok(s && s.xs.length > 0, `${id}: no primary series`);
        assert.ok(s.ys.every(v => Number.isFinite(v)), `${id}: non-finite value`);
      });
    }
  });
}
