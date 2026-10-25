/**
 * No user-facing message carries an internal field key (John, 17 Oct 2026: "Mms_kg, Fs_hz and
 * Cms_m_per_N leak into user messages everywhere"). Messages are read from the places a person
 * reads them: every field's dq, the driver's reasons, and the issue sentences themselves.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {driverFromSpec, radiatorFromSpec} from '../fixtures/recordBuilders.js';

const KEY = /_(kg|hz|m|m2|m3|m_per_N|ohm|Tm|per_K|kg_per_s)\b/;

const texts = (fields: readonly {readonly dq: readonly {readonly text: string}[]}[]): string[] =>
  fields.flatMap(f => f.dq.map(i => i.text));

describe('user messages use plain names', () => {
  it('the issue constructors', () => {
    const engine = createEngine();
    const all = [
      engine.issues.missingDependencies('Mms_kg', [{formula: 'Mms = 1/((2π·Fs)²·Cms)', required: ['Fs_hz', 'Cms_m_per_N'], missing: ['Fs_hz']}]).text,
      engine.issues.missingDependencies('length_m', [{formula: 'length_m from tuning_goal_hz + Vb_m3 + area_m2 (Helmholtz)', required: ['tuning_goal_hz'], missing: ['area_m2']}]).text,
      engine.issues.inconsistentInputs('Mms_kg', ['Fs_hz', 'Mms_kg', 'Cms_m_per_N'], 'Mms = 1/((2π·Fs)²·Cms)', 1, 1.065, 0.065).text,
    ];
    for (const t of all) expect(t).not.toMatch(KEY);
    expect(all[0]).toBe('moving mass (Mms) cannot be calculated yet - state Mms = 1/((2π·Fs)²·Cms) (needs resonance (Fs)).');
  });

  it('a radiator with a figure missing, and one with figures that disagree', () => {
    const engine = createEngine();
    const driver = driverFromSpec(engine, {Fs_hz: 30, Qes: 0.4, Qms: 4, Re_ohm: 6.4, Sd_m2: 0.02, Vas_m3: 0.05});
    const specs: Record<string, number>[] = [
      {Qms: 3.3, Vas_m3: 0.0048, Sd_m2: 0.0095},
      {Fs_hz: 30, Qms: 3.3, Vas_m3: 0.0048, Sd_m2: 0.0095, Mms_kg: 0.05, Cms_m_per_N: 0.0004},
    ];
    for (const spec of specs) {
      const p = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
      p.box.boxType.set('box-passive-radiator');
      p.box.passiveRadiator.configurePR(radiatorFromSpec(engine, spec));
      const s = p.box.passiveRadiator.radiator.spec;
      const pr = p.box.passiveRadiator;
      pr.tuning_goal_hz.set(25);
      pr.tuning_goal_hz.clear();
      const found = texts([s.Fs_hz, s.Qms, s.Vas_m3, s.Sd_m2, s.Mms_kg, s.Cms_m_per_N, s.Rms_kg_per_s, pr.tuning_goal_hz, pr.addedMass_kg]);
      for (const t of found) expect(t).not.toMatch(KEY);
    }
  });

  it('a driver with a figure missing, and the reasons the editor lists', () => {
    const engine = createEngine();
    const driver = driverFromSpec(engine, {Qes: 0.4, Qms: 4, Mms_kg: 0.05});
    const sp = driver.specs;
    const found = texts([sp.Fs_hz, sp.Vas_m3, sp.Re_ohm, sp.Sd_m2, sp.Qts, sp.Qes, sp.Qms, sp.Mms_kg, sp.Cms_m_per_N]);
    for (const t of found) expect(t).not.toMatch(KEY);
    for (const r of driver.chartBlockingReasons()) expect(`${r.subject} ${r.text}`).not.toMatch(KEY);
  });
});
