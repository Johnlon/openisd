/** T744 (QO509): a typed driver Mms moves the charts, as on a radiator. Fs is worked out again; Cms and Vas stay as stated. */
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

const GRID: FrequencyGrid = {fmin: 10, fmax: 2000, N: 40};
const E150HE = {Fs_hz: 40, Qes: 0.45, Qms: 2.94, Re_ohm: 6.6, Sd_m2: 0.009503, Vas_m3: 0.007645536, Xmax_m: 0.008, Pe_W: 100};
const TYPED_MMS = 0.03;

function build() {
  const engine = createEngine();
  return new ProjectBuilder(driverFromSpec(engine, E150HE), engine).sealed().volume_m3(0.03).build();
}

describe('driver: a typed Mms wins', () => {
  it('the box shows the typed Mms, and Fs is worked out again from it and Cms', () => {
    const project = build();
    project.driver.specField('Mms_kg').set(TYPED_MMS);
    const {Mms_kg, Fs_hz, Cms_m_per_N, Vas_m3} = project.driver.specs;
    expect(Mms_kg.value).toBe(TYPED_MMS);
    expect(Fs_hz.entered).toBe(false);
    expect(Fs_hz.value).toBeCloseTo(1 / (2 * Math.PI * Math.sqrt(TYPED_MMS * Cms_m_per_N.value!)), 6);
    expect(Cms_m_per_N.entered).toBe(false);
    expect(Vas_m3.value).toBe(E150HE.Vas_m3);
  });

  it('the charts use the typed Mms', () => {
    const before = build().sweep(GRID).values!.spl;
    const project = build();
    project.driver.specField('Mms_kg').set(TYPED_MMS);
    const after = project.sweep(GRID).values!.spl;
    expect(Math.max(...after.map((v, i) => Math.abs(v - before[i]!)))).toBeGreaterThan(0.1);
  });
});
