import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {OpenISDPassiveRadiatorStandalone, OpenISDProject, ProjectBuilder} from '../../domain/index.js';
import {whatIfSpec, prSpecSection, driverFrom, driverJson} from '../fixtures/domainBuilders.js';

describe('OpenISDProject sweep guards', () => {
  describe('the vent/PR sweep-level guards', () => {
    // A CIRCUIT-COMPLETE driver (the store's `appState-issues.test.ts` clean-fixture field
    // set): Qts derived from stated Qes/Qms so nothing can contradict, Mms/Rms/Bl/Cms derived by
    // the solver, and Re stated — sweeping is possible at all, so the vent/PR guards below are
    // the ONLY expected blockers.
    const project = (box: 'vented' | 'bp4' | 'pr') => {
      let p: OpenISDProject;
      if (box === 'pr') {
        p = new ProjectBuilder(driverFrom({
          brand: 'Dayton', model: 'RS225', section: 'woofer',
          spec: whatIfSpec({ Fs_hz: 37, Vas_m3: 0.0300, Qes: 0.40, Qms: 7.0, Re_ohm: 5.6 }),
        }), createEngine())
          .passiveRadiator().volume_m3(0.05).tuning_goal_hz(45)
          .radiator(radiator())
          .build();
      } else {
        p = new ProjectBuilder(driverFrom({
          brand: 'Dayton', model: 'RS225', section: 'woofer',
          spec: whatIfSpec({ Fs_hz: 37, Vas_m3: 0.0300, Qes: 0.40, Qms: 7.0, Re_ohm: 5.6 }),
        }), createEngine()).vented().volume_m3(0.05).tuning_goal_hz(40).build();
      }
      const w = p.driver.specs;
      w.Sd_m2.set(0.0133);
      w.Le_H.set(0.70e-3);
      w.Xmax_m.set(0.0050);
      w.Pe_W.set(60);
      return p;
    };
    const radiatorJson = () => driverJson({
      brand: 'SB Acoustics', model: 'SB23PACS', section: 'passive-radiator',
      spec: prSpecSection({ Fs_hz: 1 / (2 * Math.PI * Math.sqrt(0.09 * 0.0009)), Sd_m2: 0.025, Cms_m_per_N: 0.0009, Mmd_kg: 0.09, Rms_Ns_per_m: 1.5, Xmax_m: 0.015 }),
    });
    const radiator = () => {
      const r = OpenISDPassiveRadiatorStandalone.fromConformingRecord(radiatorJson());
      if (Array.isArray(r)) throw new Error(`fixture radiator is invalid: ${r.join(', ')}`);
      return r;
    };

    it('a vented project with no tuning_goal_hz and no length_m reports a blocking VentIssue, not NaN curves', () => {
      // The silent-gap finding this closes: an unsized vent port produced `sweep().issues === []`
      // while zmag/zph/exc went NaN, and only the UI's generic classifyFinite postcondition ever
      // complained. The sweep must name the unstated vent target itself.
      const p = project('vented');
      // Clearing the entered tuning of a driver with a design falls back to the starting
      // alignment (John, 2026-10-01); a blank pair is what a driver with no design leaves.
      p.driver.specs.Vas_m3.clear();
      p.box.vented.tuning_goal_hz.clear();
      p.driver.specs.Vas_m3.set(0.03);
      p.box.vented.vent.shape.set('round');
      p.box.vented.vent.diameter_m.set(0.1);

      const result = p.sweep({ fmin: 10, fmax: 100, N: 10 });
      expect(result.values).toBeNull();
      const issue = result.issues[0];
      expect(issue).toBeDefined();
      expect(issue).toMatchObject({ kind: 'missing-dependencies' });
      if (issue.kind === 'missing-dependencies') {
        expect(issue.target).toBe('length_m');
        expect([...issue.routes[0].required].sort()).toEqual(['Vb_m3', 'area_m2', 'tuning_goal_hz']);
        expect(issue.routes[0].missing).toContain('tuning_goal_hz');
      }
    });

    it('a vented project with an inconsistent (negative) tuning_goal_hz reports the cached solveVent issue on both sweep() and maxCurves()', () => {
      const p = project('vented');
      p.box.vented.tuning_goal_hz.set(-5);

      const sw = p.sweep({ fmin: 10, fmax: 100, N: 10 });
      expect(sw.values).toBeNull();
      expect(sw.issues.length).toBeGreaterThan(0);

      const mx = p.maxCurves({ fmin: 10, fmax: 100, N: 10 });
      expect(mx.values).toBeNull();
      expect(mx.issues.length).toBeGreaterThan(0);
    });

    it('ventAchievedFb/ventMaxReachableFb answer not-available when the box is not vented', () => {
      const p = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: whatIfSpec({ Fs_hz: 37, Vas_m3: 0.0300, Qes: 0.40, Qms: 7.0, Re_ohm: 5.6 }),
      }), createEngine()).sealed().volume_m3(0.02).build();

      expect(p.ventAchievedFb.value).toBeNull();
      expect(p.ventAchievedFb.value).toBe(null);
      expect(p.ventMaxReachableFb.value).toBeNull();
      expect(p.ventMaxReachableFb.value).toBe(null);
      expect(p.box.vented.vent.length_m.dq.some(issue => issue.kind === 'target-unreachable')).toBe(false);
    });

    it('ventAchievedFb/ventMaxReachableFb answer not-available while the vent geometry is unstated', () => {
      const p = project('vented');
      // `build()` gave the vent its 50 mm starting diameter; this test is about no geometry at all.
      p.box.vented.vent.diameter_m.clear();

      expect(p.ventAchievedFb.value).toBeNull();
      expect(p.ventMaxReachableFb.value).toBeNull();
    });

    it('ventAchievedFb/ventMaxReachableFb report calculated readouts once the vent geometry is complete', () => {
      const p = project('vented');
      p.box.vented.vent.shape.set('round');
      p.box.vented.vent.diameter_m.set(0.1);

      expect(p.ventAchievedFb.calculated).toBe(true);
      expect(p.ventAchievedFb.value).not.toBeNull();
      expect(p.ventMaxReachableFb.calculated).toBe(true);
      // The L=0 ceiling is always at or above whatever length>0 the vent currently achieves.
      expect(p.ventMaxReachableFb.value!).toBeGreaterThan(p.ventAchievedFb.value!);
    });

    it('an unreachable entered tuning writes null and a target-unreachable dq mark onto length_m, cleared once reachable again', () => {
      const p = project('vented');
      p.box.vented.vent.shape.set('round');
      p.box.vented.vent.diameter_m.set(0.1);

      expect(p.box.vented.vent.length_m.dq.some(issue => issue.kind === 'target-unreachable')).toBe(false);

      // Same physics as VentEngine.lengthForTuning's doc comment: past some tuning, for this volume
      // and port area, the only solution for length is negative — the target is unreachable.
      p.box.vented.tuning_goal_hz.set(200);

      expect(p.box.vented.vent.length_m.value).toBeNull();
      expect(p.box.vented.vent.length_m.dq.some(issue => issue.kind === 'target-unreachable')).toBe(true);

      p.box.vented.tuning_goal_hz.set(40);
      expect(p.box.vented.vent.length_m.value).toBeGreaterThan(0);
      expect(p.box.vented.vent.length_m.dq.some(issue => issue.kind === 'target-unreachable')).toBe(false);
    });

    it('a passive-radiator project missing PR mass reports a blocking PrIssue, not NaN curves', () => {
      // The radiator is configured and the resonance TARGET (tuning_goal_hz) is stated, but the
      // radiator's own mass (`Mms` → `prMmd_kg`) is missing — the geometry the addedMass route
      // needs. `checkPrConsistency` fires because a target WAS stated; this is the "missing PR
      // mass" case of the plan. (A radiator with no target at all still sweeps un-tuned — pinned
      // by project-sweep.test.ts — so that case must stay silent.)
      const p = project('pr');
      p.box.passiveRadiator.radiator.spec.Mms_kg.clear();
      p.box.passiveRadiator.radiator.spec.Fs_hz.clear();

      const result = p.sweep({ fmin: 10, fmax: 100, N: 10 });
      expect(result.values).toBeNull();
      const issue = result.issues[0];
      expect(issue).toBeDefined();
      expect(issue).toMatchObject({ kind: 'missing-dependencies' });
      if (issue.kind === 'missing-dependencies') {
        expect(issue.target).toBe('addedMass_kg');
        expect([...issue.routes[0].required].sort().join(',')).toBe('Vb_m3,prCms_m_per_N,prMmd_kg,prSd_m2,tuning_goal_hz');
        expect(issue.routes[0].missing).toEqual(['prMmd_kg']);
      }
    });

    it('stating the tuning clears the vent guard — the sweep runs', () => {
      const p = project('vented');
      p.box.vented.vent.shape.set('round');
      p.box.vented.vent.diameter_m.set(0.1);

      const result = p.sweep({ fmin: 10, fmax: 100, N: 10 });
      expect(result.values).not.toBeNull();
      expect(result.issues).toEqual([]);
    });

    it('two ports of the same size at the same tuning move the same air through twice the opening — port velocity halves', () => {
      const p = project('vented');
      p.box.vented.vent.shape.set('round');
      p.box.vented.vent.diameter_m.set(0.1);
      const one = p.sweep({ fmin: 10, fmax: 100, N: 10 });
      p.box.vented.vent.count.set(2);
      const two = p.sweep({ fmin: 10, fmax: 100, N: 10 });
      if (one.values === null || two.values === null) throw new Error('sweep did not run');
      const i = 5;
      expect(one.values.pv[i]).toBeGreaterThan(0);
      expect(two.values.pv[i]).toBeCloseTo(one.values.pv[i] / 2, 9);
    });

    // Regression for bugs/archive/BUG_20260927_winisd-charts-missing*.md
    it('project.charts is the engine\'s own answer for this project\'s box type', () => {
      const engine = createEngine();
      for (const box of ['vented', 'bp4', 'pr'] as const) {
        const p = project(box);
        expect(p.charts).toEqual(engine.box.chartsFor(p.box.boxType.value));
      }
    });

    it('project.charts follows a box-type change — port/PR charts are not stuck from a previous box', () => {
      const p = project('vented');
      expect(p.charts).toContain('RearPort');
      expect(p.charts).not.toContain('PRTFMag');

      p.box.boxType.set('sealed');
      expect(p.charts).not.toContain('RearPort');
      expect(p.charts).not.toContain('PRTFMag');
    });

    it('an open PR chart leaves the stack on a vented box and returns on a PR box', () => {
      const p = project('pr');
      p.openCharts.showOnly('SPL');
      p.openCharts.toggle('PRExcursion');
      expect(p.openCharts.value).toContain('PRExcursion');

      p.box.boxType.set('vented');
      expect(p.openCharts.value).toEqual(['SPL']);

      p.box.boxType.set('box-passive-radiator');
      expect(p.openCharts.value).toContain('PRExcursion');
    });
  });

  describe('sweep()/maxCurves() reach every box topology\'s own params (bandpass4, box-passive-radiator)', () => {
    const circuitCompleteDriver = () => {
      const driver = driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: whatIfSpec({ Fs_hz: 37, Vas_m3: 0.0300, Qes: 0.40, Qms: 7.0, Re_ohm: 5.6 }),
      });
      driver.specs.Sd_m2.set(0.0133);
      driver.specs.Le_H.set(0.70e-3);
      driver.specs.Xmax_m.set(0.0050);
      driver.specs.Pe_W.set(60);
      return driver;
    };

    it('a bandpass4 project with a sized front vent sweeps clean — covers the bandpass4 loss/volume/vent params', () => {
      const p = new ProjectBuilder(circuitCompleteDriver(), createEngine())
        .bandpass4().rearVolume_m3(0.02).frontVolume_m3(0.03).frontTuning_hz(45)
        .build();
      p.box.bandpass4.vents.front.shape.set('round');
      p.box.bandpass4.vents.front.diameter_m.set(0.1);

      const result = p.sweep({ fmin: 10, fmax: 100, N: 10 });
      expect(result.values).not.toBeNull();
      expect(result.issues).toEqual([]);
    });

    it('a box-passive-radiator project with every PR quantity stated sweeps clean — covers the PR params\' full set', () => {
      const p = new ProjectBuilder(circuitCompleteDriver(), createEngine())
        .passiveRadiator().volume_m3(0.03).tuning_goal_hz(45)
        .radiator(radiatorFor(OpenISDPassiveRadiatorStandalone.fromConformingRecord(driverJson({
          brand: 'SB Acoustics', model: 'SB23PACS', section: 'passive-radiator',
          spec: prSpecSection({ Fs_hz: 1 / (2 * Math.PI * Math.sqrt(0.09 * 0.0009)), Sd_m2: 0.025, Cms_m_per_N: 0.0009, Mmd_kg: 0.09, Rms_Ns_per_m: 1.5, Xmax_m: 0.015 }),
        }))))
        .build();
      p.box.passiveRadiator.addedMass_kg.set(0.05);

      const result = p.sweep({ fmin: 10, fmax: 100, N: 10 });
      expect(result.values).not.toBeNull();
      expect(result.issues).toEqual([]);

      const mx = p.maxCurves({ fmin: 10, fmax: 100, N: 10 });
      expect(mx.values).not.toBeNull();
    });

    function radiatorFor(r: OpenISDPassiveRadiatorStandalone | string[]): OpenISDPassiveRadiatorStandalone {
      if (Array.isArray(r)) throw new Error(`fixture radiator is invalid: ${r.join(', ')}`);
      return r;
    }

    it('a vented box with no port geometry entered yet reports its params with Sp/Leff unset, not thrown', () => {
      const p = new ProjectBuilder(circuitCompleteDriver(), createEngine())
        .vented().volume_m3(0.02).tuning_goal_hz(40)
        .build();

      expect(() => p.boxParamsIssues()).not.toThrow();
    });

    it('a bandpass4 box with no front-port geometry entered yet reports its params with Sp/Leff unset, not thrown', () => {
      const p = new ProjectBuilder(circuitCompleteDriver(), createEngine())
        .bandpass4().rearVolume_m3(0.02).frontVolume_m3(0.03).frontTuning_hz(45)
        .build();

      expect(() => p.boxParamsIssues()).not.toThrow();
    });

    it('a box-passive-radiator with an EMPTY radiator (no spec entered) reports its params with prSd/prCms/prRms unset, not thrown', () => {
      const p = new ProjectBuilder(circuitCompleteDriver(), createEngine())
        .passiveRadiator().volume_m3(0.03).tuning_goal_hz(45)
        .radiator(OpenISDPassiveRadiatorStandalone.empty())
        .build();

      expect(() => p.boxParamsIssues()).not.toThrow();
    });
  });
});
