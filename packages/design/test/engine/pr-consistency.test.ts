import {describe, expect, it} from 'vitest';
import type {SolverField} from '../../engine/index.js';
import {createEngine} from '../../engine/index.js';
import {checkPrConsistency, fakeSolverField, solvePrConsistencyGroup} from './testSolver.js';

const engine = createEngine();

const AIR = engine.environment.solve({}).values;

const air = {rho: 1.2, c: 343};

const none = {Fs_hz: null, Qms: null, Vas_m3: null, Sd_m2: null, Mms_kg: null, Cms_m_per_N: null, Rms_kg_per_s: null};

const exact = {Fs_hz: 0, Qms: 0, Vas_m3: 0, Sd_m2: 0, Mms_kg: 0, Cms_m_per_N: 0, Rms_kg_per_s: 0};

const four = {...none, Fs_hz: 30, Qms: 3.3, Vas_m3: 0.0048, Sd_m2: 0.0095};

describe('passive radiator consistency', () => {
  describe('Engine.solvePr — handle solve, values written onto the params', () => {
    function params(p: {
      addedMass_kg?: number; tuning_goal_hz?: number; Vb_m3?: number; prMmd_kg?: number;
      prSd_m2?: number; prCms_m_per_N?: number;
    }): { addedMass_kg: SolverField; tuning_goal_hz: SolverField; Vb_m3: SolverField; prMmd_kg: SolverField; prSd_m2: SolverField; prCms_m_per_N: SolverField; prNum: SolverField; resonanceWithAddedMass_hz: SolverField; systemTuning_hz: SolverField } {
      return {
        addedMass_kg: fakeSolverField(p.addedMass_kg ?? null),
        tuning_goal_hz: fakeSolverField(p.tuning_goal_hz ?? null),
        Vb_m3: fakeSolverField(p.Vb_m3 ?? null),
        prMmd_kg: fakeSolverField(p.prMmd_kg ?? null),
        prSd_m2: fakeSolverField(p.prSd_m2 ?? null),
        prCms_m_per_N: fakeSolverField(p.prCms_m_per_N ?? null),
        prNum: fakeSolverField(1),
        resonanceWithAddedMass_hz: fakeSolverField<number>(null),
        systemTuning_hz: fakeSolverField<number>(null),
      };
    }

    it('writes the derived added mass onto its handle when tuning is stated and the geometry is complete', () => {
      const p = params({ tuning_goal_hz: 30, Vb_m3: 0.03, prMmd_kg: 0.02, prSd_m2: 0.02, prCms_m_per_N: 0.0008 });
      const issues = engine.pr.solve(p, AIR);
      expect(p.addedMass_kg.value).toBeGreaterThan(0);
      expect(p.addedMass_kg.calculated).toBe(true);
      expect(issues).toEqual([]);
    });

    it('writes the derived tuning onto its handle when added mass is stated and the geometry is complete', () => {
      const p = params({ addedMass_kg: 0.01, Vb_m3: 0.03, prMmd_kg: 0.02, prSd_m2: 0.02, prCms_m_per_N: 0.0008 });
      const issues = engine.pr.solve(p, AIR);
      expect(p.tuning_goal_hz.value).toBeGreaterThan(0);
      expect(p.tuning_goal_hz.calculated).toBe(true);
      expect(issues).toEqual([]);
    });

    it('never overwrites a stated value, even when both targets are stated', () => {
      const p = params({ tuning_goal_hz: 30, addedMass_kg: 111111, Vb_m3: 0.03, prMmd_kg: 0.02, prSd_m2: 0.02, prCms_m_per_N: 0.0008 });
      const issues = engine.pr.solve(p, AIR);
      expect(p.addedMass_kg.value).toBe(111111);
      expect(p.addedMass_kg.entered).toBe(true);
      expect(p.tuning_goal_hz.entered).toBe(true);
      expect(issues).toEqual([]);
    });

    it('leaves the blocked target not-available and reports the missing geometry', () => {
      const p = params({ tuning_goal_hz: 30 });
      const issues = engine.pr.solve(p, AIR);
      expect(p.addedMass_kg.value).toBeNull();
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'addedMass_kg' });
    });
  });

  describe('checkPrConsistency (a test-only bag wrapper over Engine.solvePr) — missing-dependencies', () => {
    it('returns no issues once tuning_goal_hz solves from a complete PR geometry', () => {
      const solved = solvePrConsistencyGroup({
        tuning_goal_hz: 30, Vb_m3: 0.03, prMmd_kg: 0.02, prSd_m2: 0.02, prCms_m_per_N: 0.0008,
      }, AIR);
      expect(checkPrConsistency(solved)).toEqual([]);
    });

    it('reports a missing-dependencies issue for addedMass_kg when tuning_goal_hz is stated but the geometry is not', () => {
      const solved = solvePrConsistencyGroup({ tuning_goal_hz: 30 }, AIR);
      const issues = checkPrConsistency(solved);
      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({ kind: 'missing-dependencies', target: 'addedMass_kg' });
    });

    it('reports no issue when nothing that implies a target is stated', () => {
      const solved = solvePrConsistencyGroup({}, AIR);
      expect(checkPrConsistency(solved)).toEqual([]);
    });

    it('reports target-unreachable when the entered tuning needs negative added mass', () => {
      const issues = checkPrConsistency({
        tuning_goal_hz: 1000, Vb_m3: 0.03, prMmd_kg: 0.02, prSd_m2: 0.02, prCms_m_per_N: 0.0008,
      }, AIR);
      expect(issues.some(i => i.kind === 'target-unreachable' && i.target === 'addedMass_kg')).toBe(true);
    });

    it('reports an inconsistent-inputs issue for a non-positive tuning frequency', () => {
      const issues = checkPrConsistency({ tuning_goal_hz: -5 });
      expect(issues.some(i => i.kind === 'inconsistent-inputs' && i.target === 'tuning_goal_hz')).toBe(true);
    });
  });

  describe('PrEngine.checkSpec: stated radiator figures against the driver consistency relations', () => {
    it('four figures alone state nothing that can disagree', () => {
      expect(engine.pr.checkSpec(four, exact, air)).toEqual([]);
    });

    it('a full set that agrees raises nothing', () => {
      const all = engine.pr.solveSpec(four, air);
      expect(engine.pr.checkSpec(all, exact, air)).toEqual([]);
    });

    it('an Mms off by 10% disagrees with Fs and Cms, and names the relation and every field in it', () => {
      const all = engine.pr.solveSpec(four, air);
      const issues = engine.pr.checkSpec({...all, Mms_kg: all.Mms_kg! * 1.1}, exact, air);
      const fs = issues.find(i => i.kind === 'inconsistent-inputs' && i.target === 'Fs_hz');
      expect(fs?.fields).toEqual(expect.arrayContaining(['Fs_hz', 'Mms_kg', 'Cms_m_per_N']));
      const rms = issues.find(i => i.kind === 'inconsistent-inputs' && i.target === 'Rms_kg_per_s');
      expect(rms?.fields).toEqual(expect.arrayContaining(['Rms_kg_per_s', 'Fs_hz', 'Mms_kg', 'Qms']));
    });

    it('a blank Qms leaves Rms unstated and names Qms as what Rms needs', () => {
      const {Qms: _q, ...rest} = engine.pr.solveSpec(four, air);
      const issues = engine.pr.checkSpec({...rest, Qms: null, Rms_kg_per_s: null}, exact, air);
      expect(issues.map(i => [i.kind, i.target])).toEqual([['missing-dependencies', 'Rms_kg_per_s']]);
    });

    it('a blank Vas and Cms report only the root: Cms needs Vas, not Mms and Rms as well', () => {
      const all = engine.pr.solveSpec(four, air);
      const issues = engine.pr.checkSpec({...all, Vas_m3: null, Cms_m_per_N: null, Mms_kg: null, Rms_kg_per_s: null}, exact, air);
      expect(issues.map(i => [i.kind, i.target])).toEqual([['missing-dependencies', 'Cms_m_per_N']]);
    });

    it('the shipped ND140-PR figures agree within their own stated precision', () => {
      const nd140 = {Fs_hz: 44.2, Qms: 4.02, Vas_m3: 0.0084, Sd_m2: 0.00866, Mms_kg: 0.0164, Cms_m_per_N: 0.00079, Rms_kg_per_s: null};
      const precision = {Fs_hz: 0.05, Qms: 0.005, Vas_m3: 0.00005, Sd_m2: 0.000005, Mms_kg: 0.00005, Cms_m_per_N: 0.000005, Rms_kg_per_s: 0};
      expect(engine.pr.checkSpec(nd140, precision, air)).toEqual([]);
    });

    it('the stated precision widens what counts as agreement', () => {
      const all = engine.pr.solveSpec(four, air);
      const off = {...all, Mms_kg: all.Mms_kg! * 1.1};
      expect(engine.pr.checkSpec(off, exact, air).length).toBeGreaterThan(0);
      expect(engine.pr.checkSpec(off, {...exact, Mms_kg: all.Mms_kg! * 0.2}, air)).toEqual([]);
    });
  });

  describe('PrEngine.solveSpec — a radiator\'s seven figures through the driver consistency relations', () => {
    it('derives Cms from Vas and Sd, Mms from Fs and Cms, Rms from Qms, Fs and Mms', () => {
      const s = engine.pr.solveSpec({...none, Fs_hz: 30, Qms: 3.3, Vas_m3: 0.0048, Sd_m2: 0.0095}, air);
      const cms = 0.0048 / (air.rho * air.c * air.c * 0.0095 * 0.0095);
      const mms = 1 / ((2 * Math.PI * 30) ** 2 * cms);
      expect(s.Cms_m_per_N).toBeCloseTo(cms, 15);
      expect(s.Mms_kg! / mms).toBeCloseTo(1, 12);
      expect(s.Rms_kg_per_s! / (2 * Math.PI * 30 * mms / 3.3)).toBeCloseTo(1, 12);
    });

    it('keeps an entered Mms, Cms or Rms and derives Fs from Mms and Cms', () => {
      const s = engine.pr.solveSpec({...none, Mms_kg: 0.05, Cms_m_per_N: 0.0005, Rms_kg_per_s: 2}, air);
      expect(s.Mms_kg).toBe(0.05);
      expect(s.Cms_m_per_N).toBe(0.0005);
      expect(s.Rms_kg_per_s).toBe(2);
      expect(s.Fs_hz).toBeCloseTo(1 / (2 * Math.PI * Math.sqrt(0.05 * 0.0005)), 12);
    });

    it('leaves Rms unsolved while Qms is blank', () => {
      const s = engine.pr.solveSpec({...none, Fs_hz: 30, Vas_m3: 0.0048, Sd_m2: 0.0095}, air);
      expect(s.Rms_kg_per_s).toBeNull();
      expect(s.Mms_kg).not.toBeNull();
    });

    it('reads the air it is given', () => {
      const thin = engine.pr.solveSpec({...none, Vas_m3: 0.0048, Sd_m2: 0.0095}, {rho: 1.0, c: 343});
      const dense = engine.pr.solveSpec({...none, Vas_m3: 0.0048, Sd_m2: 0.0095}, {rho: 1.2, c: 343});
      expect(thin.Cms_m_per_N! / dense.Cms_m_per_N!).toBeCloseTo(1.2, 12);
    });
  });
});
