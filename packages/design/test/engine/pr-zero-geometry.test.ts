/**
 * T930 (ultra review finding 8): a passive radiator with Sd 0, Cms 0 or Mmd 0 (all impossible) used
 * to be accepted as "complete geometry" because the engine only checked "not null", and wrote NaN or
 * Infinity as the calculated tuning, system tuning, added mass and resonance. The geometry needs
 * Mmd, Sd and Cms above 0, as the vent engine does for its own; the readouts stay blank with an
 * issue, never NaN.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import type {SolverInput} from '@openisd/design/engine';
import {fakeSolverField} from './testSolver.js';
import {REFERENCE_AIR} from '../fixtures/referenceAir.js';

const engine = createEngine();
const inp = (v: number | null): SolverInput => ({value: v, entered: v !== null});

function params(geometry: {Mmd: number; Sd: number; Cms: number}, goal: {addedMass: number | null; tuning: number | null}) {
  return {
    addedMass_kg: fakeSolverField<number>(goal.addedMass), tuning_goal_hz: fakeSolverField<number>(goal.tuning),
    resonanceWithAddedMass_hz: fakeSolverField<number>(null), systemTuning_hz: fakeSolverField<number>(null),
    Vb_m3: inp(0.02), prMmd_kg: inp(geometry.Mmd), prSd_m2: inp(geometry.Sd), prCms_m_per_N: inp(geometry.Cms), prNum: inp(1),
  };
}

const BAD = [
  // The radiator's own resonance with the added mass needs only Mmd and Cms, so Sd 0 leaves it valid.
  {name: 'Sd 0', geometry: {Mmd: 0.01, Sd: 0, Cms: 0.0008}, resonanceBlank: false},
  {name: 'Cms 0', geometry: {Mmd: 0.01, Sd: 0.0133, Cms: 0}, resonanceBlank: true},
  {name: 'Mmd 0', geometry: {Mmd: 0, Sd: 0.0133, Cms: 0.0008}, resonanceBlank: true},
];

describe('passive radiator geometry needs Mmd, Sd and Cms above 0 (T930)', () => {
  for (const {name, geometry, resonanceBlank} of BAD) {
    it(`${name}, added mass typed: tuning, system tuning and resonance are blank with an issue, never NaN`, () => {
      const p = params(geometry, {addedMass: 0.02, tuning: null});
      const issues = engine.pr.solve(p, REFERENCE_AIR);
      expect(p.tuning_goal_hz.value).toBe(null);
      expect(p.systemTuning_hz.value).toBe(null);
      expect(issues.length).toBeGreaterThan(0);
      for (const f of [p.tuning_goal_hz, p.systemTuning_hz, p.resonanceWithAddedMass_hz]) {
        expect(f.value === null || Number.isFinite(f.value)).toBe(true);
      }
      if (resonanceBlank) expect(p.resonanceWithAddedMass_hz.value).toBe(null);
    });

    it(`${name}, tuning typed: added mass and system tuning are blank with an issue, never NaN`, () => {
      const p = params(geometry, {addedMass: null, tuning: 30});
      const issues = engine.pr.solve(p, REFERENCE_AIR);
      expect(p.addedMass_kg.value).toBe(null);
      expect(p.systemTuning_hz.value).toBe(null);
      if (resonanceBlank) expect(p.resonanceWithAddedMass_hz.value).toBe(null);
      expect(issues.length).toBeGreaterThan(0);
    });
  }

  it('a normal radiator still solves (unchanged)', () => {
    const p = params({Mmd: 0.01, Sd: 0.0133, Cms: 0.0008}, {addedMass: 0.02, tuning: null});
    const issues = engine.pr.solve(p, REFERENCE_AIR);
    expect(issues).toEqual([]);
    expect(Number.isFinite(p.tuning_goal_hz.value)).toBe(true);
    expect(p.systemTuning_hz.value).toBe(p.tuning_goal_hz.value);
  });
});
