import {describe, expect, it} from 'vitest';
import {type Engine, createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {driverFromSpec, radiatorFromSpec} from '../fixtures/recordBuilders.js';

const four = {Fs_hz: 30, Qms: 3.3, Vas_m3: 0.0048, Sd_m2: 0.0095};

function radiatorSpec(engine: Engine, radiator: Record<string, number> = four, halfWidths: Record<string, number> = {}) {
  const driver = driverFromSpec(engine, {
    Fs_hz: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re_ohm: 6.4,
    Sd_m2: 0.02, Cms_m_per_N: 0.0005, Vas_m3: 0.05, BL_Tm: 8, Mms_kg: 0.05, Xmax_m: 0.008, Pe_W: 100,
  });
  const project = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
  project.box.boxType.set('box-passive-radiator');
  project.box.passiveRadiator.configurePR(radiatorFromSpec(engine, radiator, halfWidths));
  project.box.passiveRadiator.count.set(1);
  return project.box.passiveRadiator.radiator.spec;
}

/** The Mms the four figures give. */
function derivedMms(engine: Engine): number {
  const derived = radiatorSpec(engine).Mms_kg.value;
  if (derived === null) throw new Error('expected a derived Mms');
  return derived;
}

const marked = (f: {dq: readonly {kind: string}[]}) => f.dq.some(i => i.kind === 'inconsistent-inputs');

describe('OpenIsdPassiveRadiatorSpec — a stated figure\'s own half-width widens what counts as agreeing', () => {
  // A typed Mms works Fs out again (QO463), so the conflict comes from a datasheet stating both.
  it('a Mms 50 % off the one the other figures give is a conflict when stated with no width', () => {
    const engine = createEngine();
    const spec = radiatorSpec(engine, {...four, Mms_kg: derivedMms(engine) * 1.5});
    expect(marked(spec.Mms_kg)).toBe(true);
  });

  it('the same Mms is no conflict when it states a half-width that covers the difference', () => {
    const engine = createEngine();
    const derived = derivedMms(engine);
    const spec = radiatorSpec(engine, {...four, Mms_kg: derived * 1.5}, {Mms_kg: derived});
    expect(marked(spec.Mms_kg)).toBe(false);
  });
});
