import {describe, expect, it} from 'vitest';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import type {OpenISDProject} from '../../domain/project/openISDProject.js';
import {createEngine} from '../../engine/Engine.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

/**
 * BUG_20261119_max-curves-include-force-flat-gain: WinISD's sealed chart routine f_4618f0
 * (winisd_research/re_ghidra/dumps/chart_point_4619e0.out) never reads the FlatResponse byte for
 * Maximum power (chart byte 11) or Maximum SPL (byte 14), so "Force flat response" leaves both
 * curves alone. The EQ sits before the amplifier and cannot change what the driver can take.
 */
const W5 = {
  Fs_hz: 45, Qes: 0.57, Qms: 3.56, Qts: 0.49, Vas_m3: 0.00485, Sd_m2: 0.0094, Re_ohm: 3.4,
  BL_Tm: 7.17, Le_H: 0.00034, Cms_m_per_N: 0.00036872, Mms_kg: 0.02881, Rms_kg_per_s: 2.2881560650261163,
  Xmax_m: 0.00925, Pe_W: 40,
};

const engine = createEngine();

const w5 = (forceFlat: boolean): OpenISDProject => {
  const project = new ProjectBuilder(driverFromSpec(engine, W5), engine).sealed().volume_m3(0.00448).build();
  project.forceFlatResponse.set(forceFlat);
  return project;
};

const GRID: FrequencyGrid = {fmin: 10, fmax: 1000, N: 400};

describe('Maximum SPL and Maximum power leave out "Force flat response" (W5, 4.48 L sealed)', () => {
  it('max SPL, max power and the Xmax-limited marks are the same with force-flat on and off', () => {
    const off = w5(false).maxCurves(GRID).values!;
    const on = w5(true).maxCurves(GRID).values!;
    expect(on.maxspl).toEqual(off.maxspl);
    expect(on.maxpwr).toEqual(off.maxpwr);
    expect(on.xlim).toEqual(off.xlim);
    // 40 W thermal limit at 10 Hz, not the 0.03 W the flattened excursion gave.
    expect(on.maxpwr[0]).toBeCloseTo(40, 6);
  });

  it('the SPL chart still shows the force-flat gain', () => {
    const off = w5(false).sweep(GRID).values!;
    const on = w5(true).sweep(GRID).values!;
    expect(on.spl[0] - off.spl[0]).toBeGreaterThan(10);
  });
});
