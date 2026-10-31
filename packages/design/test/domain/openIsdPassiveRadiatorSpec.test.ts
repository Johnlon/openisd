import {describe, expect, it} from 'vitest';
import {type Engine, createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {driverFromSpec, radiatorFromSpec} from '../fixtures/recordBuilders.js';

function radiatorSpec(engine: Engine) {
  const driver = driverFromSpec(engine, {
    Fs_hz: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re_ohm: 6.4,
    Sd_m2: 0.02, Cms_m_per_N: 0.0005, Vas_m3: 0.05, BL_Tm: 8, Mms_kg: 0.05, Xmax_m: 0.008, Pe_W: 100,
  });
  const project = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
  project.box.boxType.set('box-passive-radiator');
  project.box.passiveRadiator.configurePR(radiatorFromSpec(engine, {Fs_hz: 30, Qms: 3.3, Vas_m3: 0.0048, Sd_m2: 0.0095}));
  project.box.passiveRadiator.count.set(1);
  return project.box.passiveRadiator.radiator.spec;
}

const marked = (f: {dq: readonly {kind: string}[]}) => f.dq.some(i => i.kind === 'inconsistent-inputs');

describe('OpenIsdPassiveRadiatorSpec — a stated figure\'s own half-width widens what counts as agreeing', () => {
  it('a Mms 50 % off the one the other figures give is a conflict when stated with no width', () => {
    const spec = radiatorSpec(createEngine());
    const derived = spec.Mms_kg.value;
    if (derived === null) throw new Error('expected a derived Mms');
    spec.Mms_kg.set(derived * 1.5);
    expect(marked(spec.Mms_kg)).toBe(true);
  });

  it('the same Mms is no conflict when it states a half-width that covers the difference', () => {
    const spec = radiatorSpec(createEngine());
    const derived = spec.Mms_kg.value;
    if (derived === null) throw new Error('expected a derived Mms');
    spec.Mms_kg.set(derived * 1.5, derived * 1);
    expect(marked(spec.Mms_kg)).toBe(false);
  });
});
