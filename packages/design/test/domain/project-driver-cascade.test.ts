import {describe, expect, it, vi} from 'vitest';
import {type Engine, createEngine} from '@openisd/design/engine';
import {OpenISDDriver, OpenISDPassiveRadiatorStandalone, OpenISDProject, ProjectBuilder} from '../../domain/index.js';
import {fixtureEngine, specSection, prSpecSection, driverFrom, driverJson} from '../fixtures/domainBuilders.js';

describe('OpenISDProject driver cascade', () => {
  describe('OpenISDProject — the driver cascade resolves on every write', () => {
    /** A saved project whose embedded driver states ONLY Qes+Qms — Qts is the one relation it can
     *  derive. Built via the ordinary `.builder().build()` path (which itself calls `save()`), then
     *  re-wrapped through `OpenISDProject.wrap()` — the entry point this task adds a resolve to —
     *  so these tests exercise `wrap()` itself, not merely the builder's own already-passing path. */
    function qesQmsProject(engine: Engine): OpenISDProject {
      const driver = OpenISDDriver.empty(engine);
      driver.specs.Qes.set(0.4);
      driver.specs.Qms.set(3.0);
      const built = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
      return OpenISDProject.wrap(built.cloneSession().saved, engine);
    }

    it('wrap() resolves the driver once, and the project is not modified by it', () => {
      const engine = createEngine();
      const project = qesQmsProject(engine);
      const qts = project.driver.specs.Qts;
      expect(qts.calculated).toBe(true);
      expect(qts.value).toBeCloseTo((0.4 * 3.0) / (0.4 + 3.0), 12);
      expect(project.isModified()).toBe(false);
    });

    it('setting a driver field the project resolved from changes the dependent calculated entry, and modifies the project', () => {
      const engine = createEngine();
      const project = qesQmsProject(engine);
      project.driver.specs.Qms.set(6.0);
      const qts = project.driver.specs.Qts;
      expect(qts.value).toBeCloseTo((0.4 * 6.0) / (0.4 + 6.0), 12);
      expect(project.isModified()).toBe(true);
    });

    it('exactly one engine.solveDriver call per field set(), and zero for a bare project.driver read', () => {
      const engine = createEngine();
      const project = qesQmsProject(engine);
      const readSpy = vi.spyOn(engine.driver, 'solve');
      void project.driver;
      void project.driver.specs.Fs_hz;
      expect(readSpy).toHaveBeenCalledTimes(0);
      readSpy.mockRestore();

      const writeSpy = vi.spyOn(engine.driver, 'solve');
      project.driver.specs.Qms.set(6.0);
      expect(writeSpy).toHaveBeenCalledTimes(1);
    });

    it('a what-if edit lands its own calculated values in the what-if layer; resetWhatIf returns to the committed ones', () => {
      const engine = createEngine();
      const project = qesQmsProject(engine);
      const committedQts = project.driver.specs.Qts.value;

      project.beginWhatIf();
      project.driver.specs.Qms.set(6.0);
      const whatIfQts = project.driver.specs.Qts.value;
      expect(whatIfQts).toBeCloseTo((0.4 * 6.0) / (0.4 + 6.0), 12);
      expect(whatIfQts).not.toBeCloseTo(committedQts!, 6);

      project.resetWhatIf();
      expect(project.driver.specs.Qts.value).toBeCloseTo(committedQts!, 12);
    });

    it('a what-if edit on a top-level slot field (not a driver field) lands in the what-if layer, not the committed one', () => {
      const engine = createEngine();
      const project = qesQmsProject(engine);
      project.name.set('Committed name');
      project.save();

      project.beginWhatIf();
      project.name.set('What-if name');
      expect(project.name.value).toBe('What-if name');

      project.cancelWhatIf();
      expect(project.name.value).toBe('Committed name');
    });

    it('save() does not disturb the already-resolved derived values', () => {
      const engine = createEngine();
      const project = qesQmsProject(engine);
      project.driver.specs.Qms.set(6.0);
      const beforeSave = project.driver.specs.Qts.value;

      project.save();

      expect(project.driver.specs.Qts.value).toBeCloseTo(beforeSave!, 12);
      expect(project.isModified()).toBe(false);
    });
  });

  describe('vent + PR join the cascade', () => {
    const ventedProjectWithArea = () => {
      const p = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      }), createEngine()).vented().volume_m3(0.05).tuning_goal_hz(40).build();
      p.box.vented.vent.shape.set('round');
      p.box.vented.vent.diameter_m.set(0.1);
      return p;
    };

    it('(a) a vented project with tuning entered gets its port length solved into the record', () => {
      const p = ventedProjectWithArea();
      const cell = p.box.vented.vent.length_m;
      expect(cell.calculated).toBe(true);
      expect(cell.value).not.toBeNull();
    });

    it('(b) entering the length instead re-derives the tuning and drops the old entered target', () => {
      const p = ventedProjectWithArea();
      p.box.vented.vent.length_m.set(0.3);
      const lengthCell = p.box.vented.vent.length_m;
      const tuningCell = p.box.vented.tuning_goal_hz;
      expect(lengthCell.entered).toBe(true);
      expect(lengthCell.value).toBe(0.3);
      expect(tuningCell.calculated).toBe(true);
      expect(tuningCell.value).not.toBeCloseTo(40, 0);
    });

    const prProject = () => {
      const p = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      }), createEngine()).sealed().volume_m3(0.03).build();
      const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(driverJson({
        brand: 'SB Acoustics', model: 'SB23PACS', section: 'passive-radiator',
        spec: prSpecSection({ Fs_hz: 1 / (2 * Math.PI * Math.sqrt(0.09 * 0.0009)), Sd_m2: 0.025, Cms_m_per_N: 0.0009, Mmd_kg: 0.09, Rms_Ns_per_m: 1.5, Xmax_m: 0.015 }),
      }));
      if (Array.isArray(library)) throw new Error('fixture radiator invalid');
      p.box.passiveRadiator.radiator.update(library);
      p.box.passiveRadiator.volume_m3.set(0.03);
      p.box.boxType.set('box-passive-radiator');
      return p;
    };

    it('(c) PR: entering the added mass solves tuning into the record, and systemTuning_hz reads it', () => {
      const p = prProject();
      p.box.passiveRadiator.addedMass_kg.set(0.05);

      const tuningCell = p.box.passiveRadiator.tuning_goal_hz;
      expect(tuningCell.calculated).toBe(true);
      expect(tuningCell.value).not.toBeNull();
      expect(p.box.passiveRadiator.systemTuning_hz.value).toBeCloseTo(tuningCell.value!, 6);
    });

    it('(d) an unreachable PR target DQs every field in the pair, and clearing it clears them all', () => {
      const p = prProject();
      p.box.passiveRadiator.addedMass_kg.set(0);
      const ceiling = p.box.passiveRadiator.systemTuning_hz.value!;

      p.box.passiveRadiator.tuning_goal_hz.set(ceiling * 1.5);

      const DQ = [fixtureEngine.issues.targetUnreachable('addedMass_kg', ceiling)];
      expect(p.box.passiveRadiator.tuning_goal_hz.dq).toEqual(DQ);
      expect(p.box.passiveRadiator.addedMass_kg.dq).toEqual(DQ);
      expect(p.box.passiveRadiator.systemTuning_hz.dq).toEqual(DQ);
      expect(p.box.passiveRadiator.resonanceWithAddedMass_hz.dq).toEqual(DQ);

      p.box.passiveRadiator.tuning_goal_hz.clear();

      expect(p.box.passiveRadiator.tuning_goal_hz.dq).toEqual([]);
      expect(p.box.passiveRadiator.addedMass_kg.dq).toEqual([]);
    });

    it('(e) exactly one engine.vent.solve call per field set(), and zero for a bare project.box read', () => {
      const engine = createEngine();
      const p = new ProjectBuilder(driverFrom({
        brand: 'Dayton', model: 'RS225', section: 'woofer',
        spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
      }), engine).vented().volume_m3(0.05).tuning_goal_hz(40).build();
      p.box.vented.vent.shape.set('round');
      p.box.vented.vent.diameter_m.set(0.1);

      const readSpy = vi.spyOn(engine.vent, 'solve');
      void p.box;
      void p.box.vented.vent.length_m;
      expect(readSpy).toHaveBeenCalledTimes(0);
      readSpy.mockRestore();

      const writeSpy = vi.spyOn(engine.vent, 'solve');
      p.box.vented.vent.endCorrection_m.set(0.6);
      expect(writeSpy).toHaveBeenCalledTimes(1);
    });
  });
});
