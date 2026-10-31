/**
 * A passive radiator has no voice coil, so a record that states a mechanical limit (Xlim, "Xmech")
 * and no Xmax has that limit as its Xmax (QO327, John 31 Oct 2026: "stick xmech in the Xmax field as
 * that's what a Human would do"). A record with neither keeps the box's starting rule, twice the
 * driver's Xmax.
 */
import {describe, expect, it} from 'vitest';
import {type Engine, createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {driverFromSpec, radiatorFromSpec} from '../fixtures/recordBuilders.js';

const base = {Fs_hz: 30, Qms: 3.33, Vas_m3: 0.00481, Sd_m2: 0.0095};

/** The wizard path: the builder takes the chosen radiator, then the box writes its starting values. */
const built = (engine: Engine, radiator: Record<string, number>) => {
  const driver = driverFromSpec(engine, {
    Fs_hz: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re_ohm: 6.4,
    Sd_m2: 0.02, Cms_m_per_N: 0.0005, Vas_m3: 0.05, BL_Tm: 8, Mms_kg: 0.05, Xmax_m: 0.008, Pe_W: 100,
  });
  const project = new ProjectBuilder(driver, engine).passiveRadiator().volume_m3(0.03).radiator(radiatorFromSpec(engine, radiator)).build();
  return project.box.passiveRadiator.radiator.spec;
};

describe('a picked passive radiator\'s Xmax', () => {
  it('a record with Xlim and no Xmax gets its Xlim as Xmax, not twice the driver\'s Xmax', () => {
    const spec = built(createEngine(), {...base, Xlim_m: 0.019});
    expect(spec.Xmax_m.value).toBe(0.019);
  });

  it('a record with both keeps its own Xmax', () => {
    const spec = built(createEngine(), {...base, Xmax_m: 0.012, Xlim_m: 0.019});
    expect(spec.Xmax_m.value).toBe(0.012);
  });

  it('a record with neither falls back to twice the driver\'s Xmax', () => {
    const spec = built(createEngine(), base);
    expect(spec.Xmax_m.value).toBeCloseTo(0.016, 12);
  });
});

describe('the Xmax a radiator record will have once picked (what the wizard step shows)', () => {
  const specOf = (radiator: Record<string, number>) => radiatorFromSpec(createEngine(), radiator).spec;

  it('is the record\'s Xlim when it has no Xmax', () => {
    expect(specOf({...base, Xlim_m: 0.019}).pickedXmax_m).toBe(0.019);
  });

  it('is the record\'s own Xmax when it has one', () => {
    expect(specOf({...base, Xmax_m: 0.012, Xlim_m: 0.019}).pickedXmax_m).toBe(0.012);
  });

  it('is blank when the record has neither', () => {
    expect(specOf(base).pickedXmax_m).toBeNull();
  });
});
