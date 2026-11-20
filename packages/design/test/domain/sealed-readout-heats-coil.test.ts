/**
 * bugs/BUG_20261118_sealed-readout-ignores-coil-heating.md: the Box tab's sealed Fsc / Qtc readout heats the voice coil.
 *
 * WinISD (winisd_research/spec/S04_sealed_box.md section 2 and quirk Q8, 0x45e150-0x45e183):
 * Qes' = Qes*(Re + Rg + Re*alfaVC*dTVC)/Re, with alfaVC the PROJECT's `[Box] alfaVC` (Driver tab "Advanced options"),
 * not the driver record's `[Driver] alfaVC`. Read off WinISD's Box tab and `.wpr` with the Tang Band W5-1138SMF of
 * runs/nd-1/w5_nd.wpr (1 driver, Vb 4.48 L, Ql 10, Qa 100, Rg 0.1; runs/s04-dtvc-20261118/):
 *   dTVC 0:                                       Qtc 0.719, Fsc 67.23 (saved Fr 67.2338865319546)
 *   dTVC 100, project alfaVC 0.0039:              Qtc 0.920, Fsc 66.64 (saved Fr 66.6438991716757)
 *   dTVC 100, driver alfaVC 0.0039, project 0:    Qtc 0.719, Fsc 67.23 (unchanged)
 * OpenISD gives that last WinISD figure with the "Coil coefficient from project" bug switch ticked; unticked it heats with
 * the driver's own 0.0039 (T917, John QO953.c16; coil-alfavc-driver-first.test.ts).
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

const engine = createEngine();

function sealedW5(driverAlfaVC_per_K: number, projectAlfaVC_per_K: number, vcTempRise_K: number, Rs_ohm: number) {
  const driver = driverFromSpec(engine, {
    Fs_hz: 45, Qes: 0.57, Qms: 3.56, Qts: 0.49, Re_ohm: 3.4, Vas_m3: 0.00485, Sd_m2: 0.0094,
    BL_Tm: 7.17, Mms_kg: 0.02881, Cms_m_per_N: 0.00036872, Rms_kg_per_s: 2.2881560650261163, Xmax_m: 0.00925, Pe_W: 40,
    alfaVC_per_K: driverAlfaVC_per_K,
  });
  const p = new ProjectBuilder(driver, engine).sealed().volume_m3(0.00448).build();
  p.winisdChartFromFsVasQms.set(true);
  p.Rs_ohm.set(Rs_ohm);
  p.box.sealed.losses.Ql.set(10);
  p.box.sealed.losses.Qa.set(100);
  p.nDrivers.set(1);
  p.alfaVC_per_K.set(projectAlfaVC_per_K);
  p.vcTempRise_K.set(vcTempRise_K);
  p.powerDrive_W.set(1);
  return p;
}

describe('the sealed Box readout heats the voice coil (WinISD numbers)', () => {
  it('a cold coil (dTVC 0) reads Qtc 0.719 and Fsc 67.23 Hz', () => {
    const s = sealedW5(0.0039, 0.0039, 0, 0.1).box.sealed;
    expect(s.q_tc.value!).toBeCloseTo(0.719, 3);
    expect(s.resonance_hz.value!).toBeCloseTo(67.23, 2);
  });

  it('dTVC 100 with the project alfaVC 0.0039 reads Qtc 0.920 and Fsc 66.64 Hz', () => {
    const s = sealedW5(0.0039, 0.0039, 100, 0.1).box.sealed;
    expect(s.q_tc.value!).toBeCloseTo(0.920, 3);
    expect(s.resonance_hz.value!).toBeCloseTo(66.64, 2);
  });

  it('dTVC 100 with only the driver record\'s alfaVC set reads WinISD\'s cold Qtc 0.719 and Fsc 67.23 Hz with "Coil coefficient from project" ticked', () => {
    // T917 (QO953.c16): unticked, OpenISD heats with the driver's own 0.0039 and reads 0.920 (coil-alfavc-driver-first.test.ts).
    const p = sealedW5(0.0039, 0, 100, 0.1);
    p.winisdProjectAlfaVC.set(true);
    const s = p.box.sealed;
    expect(s.q_tc.value!).toBeCloseTo(0.719, 3);
    expect(s.resonance_hz.value!).toBeCloseTo(67.23, 2);
  });

  it('a Qtc typed with a hot coil gives the volume that reads it back', () => {
    const p = sealedW5(0.0039, 0.0039, 100, 0.1);
    p.box.sealed.q_tc.set(0.95);
    const vb = p.box.sealed.volume_m3.value!;
    expect(vb).toBeLessThan(0.00448);
    p.box.sealed.volume_m3.set(vb);
    expect(p.box.sealed.q_tc.value!).toBeCloseTo(0.95, 3);
  });
});

describe('the coil heating in the readout is the charts\' coil heating', () => {
  // The chart circuit (engine/circuit.ts coilRdc) puts the hot Re plus Rg in series with the coil: a coil heated by
  // dTVC is the cold coil with Re*alfaVC*dTVC more source resistance. The readout must say the same.
  const extra_ohm = 3.4 * 0.0039 * 100;

  it('the readout of a hot coil is the readout of a cold coil with Re*alfaVC*dTVC more Rg', () => {
    const hot = sealedW5(0.0039, 0.0039, 100, 0.1).box.sealed;
    const cold = sealedW5(0.0039, 0.0039, 0, 0.1 + extra_ohm).box.sealed;
    expect(hot.q_tc.value!).toBeCloseTo(cold.q_tc.value!, 9);
    expect(hot.resonance_hz.value!).toBeCloseTo(cold.resonance_hz.value!, 9);
  });

  it('the transfer-function chart of a hot coil is the chart of a cold coil with Re*alfaVC*dTVC more Rg', () => {
    const grid: FrequencyGrid = {fmin: 10, fmax: 400, N: 400};
    const hot = sealedW5(0.0039, 0.0039, 100, 0.1).sweep(grid).values!;
    const cold = sealedW5(0.0039, 0.0039, 0, 0.1 + extra_ohm).sweep(grid).values!;
    const coldCoil = sealedW5(0.0039, 0.0039, 0, 0.1).sweep(grid).values!;
    for (let i = 0; i < hot.fs.length; i += 40) {
      expect(hot.tfMag[i]!).toBeCloseTo(cold.tfMag[i]!, 6);
    }
    // and the heating does move the chart, so the comparison above is not empty
    expect(Math.abs(hot.tfMag[40]! - coldCoil.tfMag[40]!)).toBeGreaterThan(0.1);
  });
});
