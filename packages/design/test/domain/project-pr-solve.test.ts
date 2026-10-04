import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {OpenISDPassiveRadiatorStandalone, ProjectBuilder} from '../../domain/index.js';
import {driverJson, prSpecSection, sealedProject} from '../fixtures/domainBuilders.js';

/** The radiator the PR scenario fits to the box. */
function prJson() {
  return driverJson({
    brand: 'Dayton', model: 'PR250', section: 'passive-radiator',
    spec: prSpecSection({ Fs_hz: 12, Sd_m2: 0.025, Cms_m_per_N: 0.0009, Mmd_kg: 0.09, Rms_Ns_per_m: 1.5, Xmax_m: 0.015 }),
  });
}

describe('OpenISDProject passive-radiator solve', () => {
    it('PR solver group derives C/N/E state, value and structural DQ atomically', () => {
      const p = sealedProject();
      const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson());
      if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
      p.box.passiveRadiator.radiator.update(library);
      // S2-7d2: the project cascade only solves the ACTIVE box type's vent/PR pair, and
      // `systemTuning_hz` is now one of `solvePr`'s own outputs — it needs a stated `addedMass_kg`
      // (0 = bare cone) to have anything to derive FROM, unlike the old bespoke getter, which
      // defaulted an unstated mass to 0 internally.
      p.box.boxType.set('box-passive-radiator');
      p.box.passiveRadiator.volume_m3.set(0.03);
      p.box.passiveRadiator.addedMass_kg.set(0);

      const ceiling = p.box.passiveRadiator.systemTuning_hz.value!;

      p.box.passiveRadiator.addedMass_kg.clear();
      p.box.passiveRadiator.tuning_goal_hz.set(ceiling * 1.5);
      p.notifyPrChanged();

      const massCell = p.box.passiveRadiator.addedMass_kg;
      const tuningCell = p.box.passiveRadiator.tuning_goal_hz;

      expect(massCell.calculated).toBe(false);
      expect(tuningCell.entered).toBe(true);
      expect(massCell.value).toBeNull();
      const DQ = [createEngine().issues.targetUnreachable('addedMass_kg', ceiling)];
      expect(massCell.dq).toEqual(DQ);
      expect(tuningCell.dq).toEqual(DQ);
    });

    it('a vented project carries no target-unreachable dq on the passive-radiator group', () => {
      const p = new ProjectBuilder(sealedProject().driver, createEngine()).vented().volume_m3(0.03).tuning_goal_hz(35).build();
      expect(p.box.passiveRadiator.addedMass_kg.dq.some(issue => issue.kind === 'target-unreachable')).toBe(false);
    });
});
