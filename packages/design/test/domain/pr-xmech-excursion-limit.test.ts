/**
 * A passive radiator has no voice coil, so its record may state a mechanical limit (Xlim, "Xmech")
 * and no Xmax (QO327, John 31 Oct 2026). The two are separate fields, each holding only what the
 * record gives: Xmech is never copied into Xmax and no Xmax is invented. The charts read the
 * radiator's excursion limit as Xmax, or Xmech when Xmax is blank.
 */
import {describe, expect, it} from 'vitest';
import {type Engine, createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {driverFromSpec, radiatorFromSpec} from '../fixtures/recordBuilders.js';

const pick = (engine: Engine, radiator: Record<string, number>) => {
  const driver = driverFromSpec(engine, {
    Fs_hz: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re_ohm: 6.4,
    Sd_m2: 0.02, Cms_m_per_N: 0.0005, Vas_m3: 0.05, BL_Tm: 8, Mms_kg: 0.05, Xmax_m: 0.008, Pe_W: 100,
  });
  const project = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
  project.box.boxType.set('box-passive-radiator');
  project.box.passiveRadiator.configurePR(radiatorFromSpec(engine, radiator));
  return project.box.passiveRadiator.radiator.spec;
};

const base = {Fs_hz: 30, Qms: 3.33, Vas_m3: 0.00481, Sd_m2: 0.0095};

describe('passive radiator Xmax and Xmech are separate fields', () => {
  it('a record with Xlim and no Xmax: Xmax stays blank, Xlim holds the limit, the chart limit is Xlim', () => {
    const spec = pick(createEngine(), {...base, Xlim_m: 0.019});
    expect(spec.Xmax_m.value).toBeNull();
    expect(spec.Xlim_m.value).toBe(0.019);
    expect(spec.excursionLimit_m).toBe(0.019);
  });

  it('a record with both: the chart limit is Xmax and Xlim keeps its own value', () => {
    const spec = pick(createEngine(), {...base, Xmax_m: 0.012, Xlim_m: 0.019});
    expect(spec.Xmax_m.value).toBe(0.012);
    expect(spec.Xlim_m.value).toBe(0.019);
    expect(spec.excursionLimit_m).toBe(0.012);
  });

  it('a record with neither: nothing is invented, Xmax and the chart limit stay blank', () => {
    const spec = pick(createEngine(), base);
    expect(spec.Xmax_m.value).toBeNull();
    expect(spec.excursionLimit_m).toBeNull();
  });
});

/** The wizard path: the builder takes the chosen radiator, then the box writes its starting values. */
const built = (engine: Engine, radiator: Record<string, number>) => {
  const driver = driverFromSpec(engine, {
    Fs_hz: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re_ohm: 6.4,
    Sd_m2: 0.02, Cms_m_per_N: 0.0005, Vas_m3: 0.05, BL_Tm: 8, Mms_kg: 0.05, Xmax_m: 0.008, Pe_W: 100,
  });
  const project = new ProjectBuilder(driver, engine).passiveRadiator().volume_m3(0.03).radiator(radiatorFromSpec(engine, radiator)).build();
  return project.box.passiveRadiator.radiator.spec;
};

describe('the box starting values do not invent a radiator Xmax', () => {
  it('a radiator record with Xlim and no Xmax keeps Xmax blank (no twice-the-driver-Xmax)', () => {
    const spec = built(createEngine(), {...base, Xlim_m: 0.019});
    expect(spec.Xmax_m.value).toBeNull();
    expect(spec.excursionLimit_m).toBe(0.019);
  });

  it('a radiator record with neither keeps Xmax blank', () => {
    expect(built(createEngine(), base).Xmax_m.value).toBeNull();
  });
});
