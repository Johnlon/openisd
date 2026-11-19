/**
 * A passive radiator a project file holds with Sd 0, Cms 0, Mmd (Mms) 0, or Fs, Qms, Vas, Rms 0 (all
 * impossible) is repaired on opening: the loaded 0 counts as an empty box, so a figure the app can
 * calculate from the others is recalculated and shown as a calculated value, any other stays empty;
 * no data-quality mark on the box; the opening message names each repair; no readout is NaN or
 * Infinity. John, 18 Nov 2026 (QO953.c10-c26): "a repair is ok but it has to be automatic"; "no dq
 * must match value shown". Task T930, ultra review finding 8.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import type {OpenedProject} from '../../domain/project/openISDProject.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';
import {wprText} from '../fixtures/inputLimitsSweep.js';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';

const engine = createEngine();

type Figure = 'Sd_m2' | 'Cms_m_per_N' | 'Mms_kg' | 'Fs_hz' | 'Qms' | 'Vas_m3' | 'Rms_kg_per_s';

/** A saved passive-radiator project whose radiator states Sd, Mms and Cms (and Qms), with `zeroed` set to 0 in the file. */
function owprWithZero(zeroed: Figure): string {
  const driver = driverFromSpec(engine, {Fs_hz: 30, Qes: 0.4, Qms: 4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Re_ohm: 6});
  const p = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
  p.box.boxType.set('box-passive-radiator');
  const spec = p.box.passiveRadiator.radiator.spec;
  // Fs, Mms and Cms agree, so a zeroed Mms or Cms can be recalculated from the other two; Vas and Rms are not stated.
  spec.Vas_m3.clear(); spec.Rms_kg_per_s.clear();
  spec.Fs_hz.set(1 / (2 * Math.PI * Math.sqrt(0.01 * 0.0008)));
  spec.Sd_m2.set(0.0133); spec.Mms_kg.set(0.01); spec.Cms_m_per_N.set(0.0008); spec.Qms.set(5);
  p.box.passiveRadiator.volume_m3.set(0.02);
  p.box.passiveRadiator.addedMass_kg.set(0.02);
  spec[zeroed].set(0);
  p.save();
  return p.toOwprText();
}

function opened(text: string): OpenedProject {
  const result = OpenISDProject.fromOwprTextRepairing(text, engine);
  if (Array.isArray(result)) throw new Error(`the project did not open: ${result.join('; ')}`);
  return result;
}

describe('a radiator figure of 0 in a project file is repaired on opening (T930)', () => {
  for (const figure of ['Sd_m2', 'Cms_m_per_N', 'Mms_kg'] as const) {
    it(`${figure} 0: the box is repaired automatically, unmarked, named once, and no readout is NaN or Infinity`, () => {
      const {project, loadRepairs} = opened(owprWithZero(figure));
      const pr = project.box.passiveRadiator;
      const spec = pr.radiator.spec;
      expect(spec[figure].entered).toBe(false);
      // No mark about a shown value: no stated figure contradicts another.
      expect(spec[figure].dq.filter(d => d.kind === 'inconsistent-inputs')).toEqual([]);
      if (figure !== 'Sd_m2') {
        expect(spec[figure].value, 'recalculated from Fs and the other one').toBeCloseTo(figure === 'Mms_kg' ? 0.01 : 0.0008, 6);
        expect(spec[figure].calculated).toBe(true);
      }
      const named = loadRepairs.filter(r => r.text.includes('in the file'));
      expect(named).toHaveLength(1);
      expect(named[0].text).toMatch(/ 0 .* in the file: /);
      for (const f of [pr.systemTuning_hz, pr.tuning_goal_hz, pr.addedMass_kg, pr.systemTuning_hz]) {
        expect(f.value === null || Number.isFinite(f.value), `${f.value}`).toBe(true);
      }
      expect(spec.Sd_m2.value === null || spec.Sd_m2.value > 0).toBe(true);
      expect(spec.Cms_m_per_N.value === null || spec.Cms_m_per_N.value > 0).toBe(true);
      expect(spec.Mms_kg.value === null || spec.Mms_kg.value > 0).toBe(true);
    });
  }

  it('a clean radiator project opens with nothing repaired', () => {
    const driver = driverFromSpec(engine, {Fs_hz: 30, Qes: 0.4, Qms: 4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Re_ohm: 6});
    const p = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
    p.box.boxType.set('box-passive-radiator');
    p.save();
    expect(opened(p.toOwprText()).loadRepairs).toEqual([]);
  });
});

describe('a radiator figure of 0 in a WinISD .wpr is repaired on opening the same way (T930)', () => {
  for (const key of ['Sd', 'Fs', 'Vas', 'Qms']) {
    it(`[PassiveRadiator] ${key}=0: the figure is emptied and named, and no readout is NaN or Infinity`, () => {
      const plain = wprText('passive radiator');
      const text = plain.replace(new RegExp(`(\\[PassiveRadiator\\][^\\[]*?\\n${key}=)[^\\r\\n]*`), '$10');
      expect(text, `the PR .wpr states ${key}`).not.toBe(plain);
      const {value, errors, loadRepairs} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
      if (value === null) throw new Error(errors.map(e => e.message).join('; '));
      const radiatorLines = loadRepairs.filter(r => r.text.startsWith('Passive radiator '));
      expect(radiatorLines).toHaveLength(1);
      const pr = value.box.passiveRadiator;
      for (const f of [pr.systemTuning_hz, pr.tuning_goal_hz, pr.addedMass_kg]) {
        expect(f.value === null || Number.isFinite(f.value), `${f.value}`).toBe(true);
      }
    });
  }
});
