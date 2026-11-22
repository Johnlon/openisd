/**
 * T903: with Auto Y the level axis must contain the whole curve it is drawing. The Impedance
 * chart's axis never went below 1 ohm, so a curve with lower values (Tang Band W5-1138SMF, four
 * drivers in 4.48 L, falls below 1 ohm under ~45 Hz and above ~200 Hz) ran off the bottom.
 */
import {describe, it, expect} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import type {SweepParams} from '@openisd/design/engine';
import {buildPlotData, type Design, type PlotParams} from '@openisd/design/chart';
import {ProjectBuilder} from '@openisd/design';
import {REFERENCE_AIR} from '../fixtures/referenceAir.js';

const engine = createEngine();
function solvedDriver() {
  const specs = ProjectBuilder.empty(engine).driver.specs;
  specs.Fs_hz.set(45); specs.Qts.set(0.49); specs.Qes.set(0.57); specs.Qms.set(3.56);
  specs.Vas_m3.set(0.00485); specs.Sd_m2.set(0.0094); specs.Re_ohm.set(3.4); specs.Le_H.set(0.0004);
  specs.Xmax_m.set(0.00925); specs.Pe_W.set(40); specs.Znom_ohm.set(4);
  return specs.sweepDriver();
}
const drv = solvedDriver();

function design(nDrivers: number, driverWiring: SweepParams['driverWiring']): Design {
  const SP: SweepParams = {Vb: 0.00448, eg: 2.83, fmin: 10, fmax: 400, N: 300, filters: [], air: REFERENCE_AIR, nDrivers, ...(driverWiring ? {driverWiring} : {})};
  const P: PlotParams = {fmin: 10, fmax: 400};
  const curves = engine.simulation.sweep(drv, 0.0004, 'sealed', SP).values!;
  const maxCurves = engine.simulation.maxCurves(drv, 0.0004, 'sealed', SP).values!;
  return {driver: drv, box: 'sealed', P, curves, maxCurves, name: 'a', color: '#4fb0ff'};
}

describe('Auto Y contains the whole curve', () => {
  it('Impedance, four drivers: the curve dips below 1 ohm and the axis goes below it too', () => {
    const d = design(4, undefined);
    const lowest = Math.min(...d.curves!.zmag);
    expect(lowest).toBeLessThan(1);
    const p = buildPlotData(engine, 'Zmag', 10, 400, d, []).value!;
    expect(p.levelAxis.min).toBeLessThanOrEqual(lowest);
    expect(p.levelAxis.max).toBeGreaterThanOrEqual(Math.max(...d.curves!.zmag));
  });

  for (const n of [1, 4]) {
    for (const id of engine.box.chartsFor('sealed')) {
      it(`${id}, ${n} driver(s): every finite point of the main trace lies inside the axis`, () => {
        const p = buildPlotData(engine, id, 10, 400, design(n, undefined), []).value!;
        const s = p.series[0];
        const eps = 1e-9;
        for (let i = 0; i < s.ys.length; i++) {
          const y = s.ys[i];
          if (!Number.isFinite(y) || y <= -199) continue;
          expect(y, `${id} point ${i}`).toBeGreaterThanOrEqual(p.levelAxis.min - eps);
          expect(y, `${id} point ${i}`).toBeLessThanOrEqual(p.levelAxis.max + eps);
        }
      });
    }
  }
});
