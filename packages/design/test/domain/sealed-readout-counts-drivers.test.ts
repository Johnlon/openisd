/**
 * bugs/BUG_20261118_sealed-readout-ignores-driver-count.md: the Box tab's sealed Fsc / Qtc readout counts the drivers.
 *
 * WinISD (winisd_research/spec/S04_sealed_box.md section 2, 0x45e0ad-0x45e0f2): N drivers in one sealed box are one
 * driver with N*Vas; Fs and Qts unchanged. Read off WinISD's Box tab with the Tang Band W5-1138SMF of
 * runs/nd-1/w5_nd.wpr (Ql 10, Qa 100, Rg 0.1):
 *   1 driver, 4.48 L: Qtc 0.719 (runs/nd-1, spec S04 section 5, quirk 9)
 *   4 drivers, 4.48 L: Qtc 1.085 (runs/nd-1/53_nd4_vb4.48_boxtab.png)
 *   4 drivers, 17.92 L: Qtc 0.719, Fsc 67.23 Hz (runs/nd-1/60_nd4_vb17.92_boxtab.png)
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

const engine = createEngine();
const GRID: FrequencyGrid = {fmin: 10, fmax: 400, N: 4000};

function sealedW5(nDrivers: number, volume_m3: number, Ql: number, Qa: number) {
  const driver = driverFromSpec(engine, {
    Fs_hz: 45, Qes: 0.57, Qms: 3.56, Qts: 0.49, Re_ohm: 3.4, Vas_m3: 0.00485, Sd_m2: 0.0094,
    BL_Tm: 7.17, Mms_kg: 0.02881, Cms_m_per_N: 0.00036872, Rms_kg_per_s: 2.2881560650261163, Xmax_m: 0.00925, Pe_W: 40,
  });
  const p = new ProjectBuilder(driver, engine).sealed().volume_m3(volume_m3).build();
  p.Rs_ohm.set(0.1);
  p.box.sealed.losses.Ql.set(Ql);
  p.box.sealed.losses.Qa.set(Qa);
  p.nDrivers.set(nDrivers);
  p.powerDrive_W.set(1);
  return p;
}

describe('the sealed Box readout counts the drivers (WinISD numbers)', () => {
  it('1 driver in 4.48 L reads Qtc 0.719', () => {
    expect(sealedW5(1, 0.00448, 10, 100).box.sealed.q_tc.value!).toBeCloseTo(0.719, 3);
  });

  it('4 drivers in 4.48 L read Qtc 1.085', () => {
    expect(sealedW5(4, 0.00448, 10, 100).box.sealed.q_tc.value!).toBeCloseTo(1.085, 3);
  });

  it('4 drivers in 17.92 L read Qtc 0.719 and Fsc 67.23 Hz', () => {
    const p = sealedW5(4, 0.01792, 10, 100);
    expect(p.box.sealed.q_tc.value!).toBeCloseTo(0.719, 3);
    expect(p.box.sealed.resonance_hz.value!).toBeCloseTo(67.23, 2);
  });

  it('an isobaric pair reads as one driver with half the Vas', () => {
    const pair = sealedW5(1, 0.00448, 10, 100);
    pair.loading.set('isobaric');
    const half = new ProjectBuilder(driverFromSpec(engine, {
      Fs_hz: 45, Qes: 0.57, Qms: 3.56, Qts: 0.49, Re_ohm: 3.4, Vas_m3: 0.00485 / 2, Sd_m2: 0.0094,
    }), engine).sealed().volume_m3(0.00448).build();
    half.Rs_ohm.set(0.1);
    expect(pair.box.sealed.q_tc.value!).toBeCloseTo(half.box.sealed.q_tc.value!, 9);
  });

  it('a Qtc typed with 4 drivers gives the volume that reads it back, 4 times a single driver\'s', () => {
    const four = sealedW5(4, 0.00448, 10, 100);
    four.box.sealed.q_tc.set(0.8);
    const one = sealedW5(1, 0.00448, 10, 100);
    one.box.sealed.q_tc.set(0.8);
    expect(four.box.sealed.volume_m3.value!).toBeCloseTo(4 * one.box.sealed.volume_m3.value!, 9);
    const vb = four.box.sealed.volume_m3.value!;
    four.box.sealed.volume_m3.set(vb);
    expect(four.box.sealed.q_tc.value!).toBeCloseTo(0.8, 3);
  });
});

describe('the sealed readout agrees with the chart model for 1, 2 and 4 drivers', () => {
  // Lossless box (Ql, Qa at the limit) so the impedance peak is the box resonance: the readout's Fsc must
  // sit at the chart's peak. The chart runs one driver in Vb/N (SimulationEngine.oneBoxOfN).
  for (const n of [1, 2, 4]) {
    it(`${n} driver(s): readout Fsc is the chart's impedance peak, to the chart's grid`, () => {
      const p = sealedW5(n, 0.00448 * n, 1e9, 1e9);
      const swept = p.sweep(GRID).values;
      expect(swept).not.toBeNull();
      const top = swept!.zmag.indexOf(Math.max(...swept!.zmag));
      const chartFsc = swept!.fs[top]!;
      expect(Math.abs(p.box.sealed.resonance_hz.value! - chartFsc) / chartFsc).toBeLessThan(0.001);
    });
  }

  it('the same box gives the same readout whatever the count when each driver has its own 4.48 L', () => {
    const f1 = sealedW5(1, 0.00448, 10, 100).box.sealed;
    for (const n of [2, 4]) {
      const fn = sealedW5(n, 0.00448 * n, 10, 100).box.sealed;
      expect(fn.resonance_hz.value!).toBeCloseTo(f1.resonance_hz.value!, 9);
      expect(fn.q_tc.value!).toBeCloseTo(f1.q_tc.value!, 9);
    }
  });
});
