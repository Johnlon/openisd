/**
 * T744, QO534 (John, 11 Nov 2026): on the driver editor and the radiator settings, "an entered value is never overwritten
 * with a calculated value"; the charts "use the [on-screen] values not hidden recalcs always"; and when the boxes disagree,
 * "all get the mark". Rows 1-4 are the board item's acceptance examples: E150HE-44, every figure entered from the datasheet.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';
import {driverFromSpec, radiatorFromSpec} from '../fixtures/recordBuilders.js';

const GRID: FrequencyGrid = {fmin: 10, fmax: 2000, N: 40};
/** E150HE-44 as its datasheet states it (SI). */
const E150HE_44 = {
  Fs_hz: 40, Vas_m3: 0.00765, Mms_kg: 0.0266, Cms_m_per_N: 0.0006, Qms: 2.94, Qes: 0.46,
  Re_ohm: 6.6, Sd_m2: 0.0095, Xmax_m: 0.008, Pe_W: 100,
};
type Figure = 'Fs_hz' | 'Vas_m3' | 'Mms_kg' | 'Cms_m_per_N' | 'Qms' | 'Rms_kg_per_s' | 'Sd_m2';
const FIGURES: readonly Figure[] = ['Fs_hz', 'Vas_m3', 'Mms_kg', 'Cms_m_per_N', 'Qms', 'Rms_kg_per_s'];

function project() {
  const engine = createEngine();
  return new ProjectBuilder(driverFromSpec(engine, E150HE_44), engine).sealed().volume_m3(0.012).build();
}

/** The figures whose box carries a disagreement mark. */
function marked(spec: Record<Figure, {readonly dq: readonly {readonly kind: string}[]}>): Figure[] {
  return FIGURES.filter(f => spec[f].dq.some(issue => issue.kind === 'inconsistent-inputs'));
}

describe('QO534 driver editor: E150HE-44, all entered from the datasheet', () => {
  it('row 0: the datasheet as stated carries no mark', () => {
    expect(marked(project().driver.specs)).toEqual([]);
  });

  it('row 1: type Mms 34.6 g: the charts use Mms 34.6 and Cms 0.60; Fs, Mms and Cms are marked', () => {
    const p = project();
    const before = p.sweep(GRID).values!.spl;
    p.driver.specField('Mms_kg').set(0.0346);
    const {specs} = p.driver;
    for (const f of ['Fs_hz', 'Vas_m3', 'Cms_m_per_N', 'Qms'] as const) expect(specs[f].value, f).toBe(E150HE_44[f]);
    const charted = specs.sweepDriver().values;
    expect(charted.Mms_kg).toBe(0.0346);
    expect(charted.Cms_m_per_N).toBe(0.0006);
    expect(Math.max(...p.sweep(GRID).values!.spl.map((v, i) => Math.abs(v - before[i]!)))).toBeGreaterThan(0.01);
    expect(marked(specs)).toEqual(expect.arrayContaining(['Fs_hz', 'Mms_kg', 'Cms_m_per_N']));
    expect(marked(specs)).not.toContain('Vas_m3');
  });

  it('row 1: the popup says which values disagree and what the maths gives', () => {
    const p = project();
    p.driver.specField('Mms_kg').set(0.0346);
    const text = p.driver.specs.Fs_hz.dq.map(issue => issue.text).join('\n');
    expect(text).toMatch(/Fs, Mms and Cms disagree/);
    expect(text).toMatch(/gives Fs 34\.\d+ Hz/);
  });

  it('row 2: type Cms 0.80 mm/N: the charts use Mms 26.6 and Cms 0.80; Vas, Cms, Fs and Mms are marked', () => {
    const p = project();
    p.driver.specField('Cms_m_per_N').set(0.0008);
    const {specs} = p.driver;
    expect(specs.Vas_m3.value).toBe(0.00765);
    expect(specs.Vas_m3.entered).toBe(true);
    const charted = specs.sweepDriver().values;
    expect(charted.Mms_kg).toBe(0.0266);
    expect(charted.Cms_m_per_N).toBe(0.0008);
    expect(marked(specs)).toEqual(expect.arrayContaining(['Vas_m3', 'Cms_m_per_N', 'Fs_hz', 'Mms_kg']));
  });

  it('row 3: type Vas 10 L: the charts use Mms 26.6 and Cms 0.60; Vas and Cms are marked, Fs and Mms are not', () => {
    const p = project();
    p.driver.specField('Vas_m3').set(0.010, 0.00005);
    const {specs} = p.driver;
    expect(specs.Cms_m_per_N.value).toBe(0.0006);
    expect(specs.Cms_m_per_N.entered).toBe(true);
    const charted = specs.sweepDriver().values;
    expect(charted.Mms_kg).toBe(0.0266);
    expect(charted.Cms_m_per_N).toBe(0.0006);
    expect(marked(specs)).toEqual(expect.arrayContaining(['Vas_m3', 'Cms_m_per_N']));
    expect(marked(specs)).not.toContain('Fs_hz');
    expect(marked(specs)).not.toContain('Mms_kg');
  });

  it('row 4: type Rms 3.0: the charts use Rms 3.0; Qms and Rms are marked', () => {
    const p = project();
    p.driver.specField('Rms_kg_per_s').set(3.0);
    const {specs} = p.driver;
    expect(specs.Qms.value).toBe(2.94);
    expect(specs.sweepDriver().values.Rms_kg_per_s).toBe(3.0);
    expect(marked(specs)).toEqual(expect.arrayContaining(['Qms', 'Rms_kg_per_s']));
  });

  it('an empty box is calculated and shown: with no Cms stated, the box shows the Cms Vas and Sd give, and the charts use it', () => {
    const engine = createEngine();
    const {Cms_m_per_N: _cms, ...noCms} = E150HE_44;
    const p = new ProjectBuilder(driverFromSpec(engine, noCms), engine).sealed().volume_m3(0.012).build();
    const {specs} = p.driver;
    expect(specs.Cms_m_per_N.calculated).toBe(true);
    expect(specs.Cms_m_per_N.value).toBeGreaterThan(0);
    expect(specs.sweepDriver().values.Cms_m_per_N).toBe(specs.Cms_m_per_N.value);
  });

  it('the editor\'s copy follows the same rule: a typed Mms stays, the stated Vas stays, and Fs, Mms and Cms are marked', () => {
    const copy = project().driver.detach();
    copy.specField('Mms_kg').set(0.0346);
    expect(copy.specs.Vas_m3.value).toBe(0.00765);
    expect(copy.specs.sweepDriver().values.Mms_kg).toBe(0.0346);
    expect(marked(copy.specs)).toEqual(expect.arrayContaining(['Fs_hz', 'Mms_kg', 'Cms_m_per_N']));
  });
});

describe('QO534 radiator settings: the same rule', () => {
  /** A P173-style radiator whose datasheet states Fs, Vas, Sd, Mms and Cms in agreement. */
  const RADIATOR = {Fs_hz: 41, Vas_m3: 0.0243, Sd_m2: 0.013, Mms_kg: 0.0149, Cms_m_per_N: 0.00101, Qms: 5, Xmax_m: 0.01};
  function pick() {
    const p = project();
    p.box.boxType.set('box-passive-radiator');
    p.box.passiveRadiator.configurePR(radiatorFromSpec(createEngine(), RADIATOR));
    return p;
  }
  const spec = (p: ReturnType<typeof pick>) => p.box.passiveRadiator.radiator.spec;
  const markedPr = (p: ReturnType<typeof pick>): Figure[] =>
    (['Fs_hz', 'Vas_m3', 'Mms_kg', 'Cms_m_per_N', 'Qms', 'Rms_kg_per_s', 'Sd_m2'] as const).filter(f => spec(p)[f].dq.some(issue => issue.kind === 'inconsistent-inputs'));

  it('picking keeps every stated figure entered, Cms and Mms included', () => {
    const s = spec(pick());
    expect(s.Cms_m_per_N.entered).toBe(true);
    expect(s.Cms_m_per_N.value).toBe(0.00101);
    expect(s.Mms_kg.entered).toBe(true);
    expect(s.Mms_kg.value).toBe(0.0149);
  });

  it('a typed Vas moves no stated Cms or Mms; Vas and Cms are marked', () => {
    const p = pick();
    spec(p).Vas_m3.set(0.030, 0.00005);
    expect(spec(p).Cms_m_per_N.value).toBe(0.00101);
    expect(spec(p).Cms_m_per_N.entered).toBe(true);
    expect(spec(p).Mms_kg.value).toBe(0.0149);
    expect(markedPr(p)).toEqual(expect.arrayContaining(['Vas_m3', 'Cms_m_per_N']));
  });

  it('a typed Fs moves no stated Mms; Fs, Mms and Cms are marked', () => {
    const p = pick();
    spec(p).Fs_hz.set(35);
    expect(spec(p).Mms_kg.value).toBe(0.0149);
    expect(markedPr(p)).toEqual(expect.arrayContaining(['Fs_hz', 'Mms_kg', 'Cms_m_per_N']));
  });

  it('a typed Mms is what the charts use', () => {
    const p = pick();
    const before = p.sweep(GRID).values!.spl;
    spec(p).Mms_kg.set(0.02);
    expect(spec(p).Mms_kg.value).toBe(0.02);
    expect(spec(p).Fs_hz.value).toBe(41);
    expect(Math.max(...p.sweep(GRID).values!.spl.map((v, i) => Math.abs(v - before[i]!)))).toBeGreaterThan(0.01);
  });
});
