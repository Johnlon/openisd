/**
 * Picking a radiator into a project (John, QO451, 8 Nov 2026: "a stated 1.01 must not be replaced
 * by other numbers"; BUG_20261108_radiator-pick-replaces-stated-cms-mms): every stated figure is
 * kept as entered, never replaced by one worked out from its pair (Cms from Vas, Mms from Fs, Rms
 * from Qms). Stated pairs that disagree both stay and both carry the conflict mark. The "can't
 * calculate" warning marks only the empty box, never a box that has a value.
 */
import {describe, expect, it} from 'vitest';
import {type Engine, FixedAir, createEngine} from '@openisd/design/engine';
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

/** Accuton P173 as its bundled record states it: no Qms, no Rms. */
const p173 = {Fs_hz: 41, Vas_m3: 0.024, Sd_m2: 0.013, Mms_kg: 0.015, Cms_m_per_N: 0.00101, Xmax_m: 0.01};

const missing = (f: {dq: readonly {kind: string}[]}) => f.dq.some(i => i.kind === 'missing-dependencies');

describe('picking a radiator: datasheet Mms, Cms, Rms are copied or left out, never flipped', () => {
  it('P173: stated Mms 15 g and Cms 1.01 are kept entered as stated (QO451); Rms is unknown', () => {
    const spec = pick(createEngine(), p173);
    expect(spec.Mms_kg.entered).toBe(true);
    expect(spec.Mms_kg.value).toBe(0.015);
    expect(spec.Cms_m_per_N.entered).toBe(true);
    expect(spec.Cms_m_per_N.value).toBe(0.00101);
    expect(spec.Rms_kg_per_s.value).toBeNull();
  });

  it('P173: Cms 1.01 and Vas 24 L agree within their stated rounding, so neither is marked', () => {
    const spec = pick(createEngine(), p173);
    expect(spec.Cms_m_per_N.dq).toEqual([]);
    expect(spec.Vas_m3.dq).toEqual([]);
  });

  it('a stated Cms that disagrees with the stated Vas stays entered, and both carry the conflict mark', () => {
    const spec = pick(createEngine(), {...p173, Cms_m_per_N: 0.002});
    expect(spec.Cms_m_per_N.entered).toBe(true);
    expect(spec.Cms_m_per_N.value).toBe(0.002);
    expect(spec.Cms_m_per_N.dq.some(i => i.kind === 'inconsistent-inputs')).toBe(true);
    expect(spec.Vas_m3.dq.some(i => i.kind === 'inconsistent-inputs')).toBe(true);
  });

  it('a record stating Qms and Rms keeps Rms entered at its value', () => {
    const spec = pick(createEngine(), {...p173, Qms: 5, Rms_kg_per_s: 2.2});
    expect(spec.Rms_kg_per_s.entered).toBe(true);
    expect(spec.Rms_kg_per_s.value).toBe(2.2);
  });

  it('a record stating Rms but no Qms keeps Rms entered at its value', () => {
    const spec = pick(createEngine(), {...p173, Rms_kg_per_s: 2.2});
    expect(spec.Rms_kg_per_s.entered).toBe(true);
    expect(spec.Rms_kg_per_s.value).toBe(2.2);
  });

  it('a record stating Cms but no Vas keeps Cms entered and works Vas out', () => {
    const {Vas_m3: _v, ...noVas} = p173;
    const spec = pick(createEngine(), noVas);
    expect(spec.Cms_m_per_N.entered).toBe(true);
    expect(spec.Cms_m_per_N.value).toBe(0.00101);
    expect(spec.Vas_m3.calculated).toBe(true);
  });

  it('a record stating Mms but no Fs keeps Mms entered', () => {
    const {Fs_hz: _f, ...noFs} = p173;
    const spec = pick(createEngine(), noFs);
    expect(spec.Mms_kg.entered).toBe(true);
    expect(spec.Mms_kg.value).toBe(0.015);
  });
});

describe('the "can\'t calculate" warning marks only the empty box', () => {
  it('P173: Qms is marked; Mms and Cms, which are stated, are not', () => {
    const spec = pick(createEngine(), p173);
    expect(missing(spec.Qms)).toBe(true);
    expect(missing(spec.Mms_kg)).toBe(false);
    expect(missing(spec.Cms_m_per_N)).toBe(false);
  });

  it('the Qms warning says Rms is unknown and the charts take the radiator as lossless', () => {
    const spec = pick(createEngine(), p173);
    const text = spec.Qms.dq.map(i => i.text).join(' ');
    expect(text).toMatch(/Rms/);
    expect(text).toMatch(/lossless/);
  });
});

describe('a radiator edited before the project exists (the New Project wizard)', () => {
  const edited = (engine: Engine) => {
    // The record states a Cms that contradicts its Vas.
    const radiator = radiatorFromSpec(engine, {...p173, Qms: 5, Cms_m_per_N: 0.01});
    radiator.spec.adoptDatasheetFigures();
    return radiator;
  };

  it('resolving it alone works out the figures the typed Cms moves (QO463)', () => {
    const engine = createEngine();
    const radiator = edited(engine);
    radiator.resolve(engine.pr, new FixedAir({c: 343, rho: 1.2}));
    expect(radiator.spec.Rms_kg_per_s.calculated).toBe(true);
    expect(radiator.spec.Vas_m3.calculated).toBe(true);
    expect(radiator.spec.Fs_hz.calculated).toBe(true);
    expect(radiator.spec.Cms_m_per_N.dq.filter(i => i.kind === 'inconsistent-inputs')).toEqual([]);
  });

  it('the builder takes it as it stands: Cms and Vas stay stated, and the box shows the Cms the charts use, with a warning', () => {
    const engine = createEngine();
    const driver = driverFromSpec(engine, {
      Fs_hz: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re_ohm: 6.4,
      Sd_m2: 0.02, Cms_m_per_N: 0.0005, Vas_m3: 0.05, BL_Tm: 8, Mms_kg: 0.05, Xmax_m: 0.008, Pe_W: 100,
    });
    const spec = new ProjectBuilder(driver, engine).passiveRadiator().volume_m3(0.03).editedRadiator(edited(engine)).build().box.passiveRadiator.radiator.spec;
    expect(spec.Vas_m3.entered).toBe(true);
    expect(spec.Cms_m_per_N.calculated).toBe(true);
    expect(spec.Cms_m_per_N.value).toBeCloseTo(0.00101, 4);
    expect(spec.Cms_m_per_N.dq.map(i => i.text).join(' ')).toMatch(/^Datasheet Cms is [\d.]+ mm\/N\./);
  });
});
