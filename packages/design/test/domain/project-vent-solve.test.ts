import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/index.js';
import {driverFrom, sealedProject, specSection} from '../fixtures/domainBuilders.js';

/** The sealed RS225 project the vent scenarios start from, switched to a vented 30 L box tuned to 35 Hz. */
function ventedProject() {
  return new ProjectBuilder(driverFrom({
    brand: 'Dayton', model: 'RS225', section: 'woofer',
    spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
  }), createEngine()).vented().volume_m3(0.03).tuning_goal_hz(35).build();
}

describe('OpenISDProject vent solve', () => {
    it('Vent solver group derives C/N/E state, value and structural DQ atomically', () => {
      const p = sealedProject();
      p.box.boxType.set('vented');
      p.box.vented.volume_m3.set(0.03);
      p.box.vented.vent.shape.set('round');
      p.box.vented.vent.diameter_m.set(0.05);
      p.box.vented.vent.endCorrection_m.set(0.6);
      p.box.vented.vent.length_m.clear();
      p.box.vented.tuning_goal_hz.set(35);
      p.notifyVentChanged();

      const lenCell = p.box.vented.vent.length_m;
      const tuningCell = p.box.vented.tuning_goal_hz;

      expect(tuningCell.entered).toBe(true);
      expect(lenCell.calculated).toBe(true);
      expect(lenCell.value).toBeGreaterThan(0);
      expect(lenCell.dq).toEqual([]);
      expect(tuningCell.dq).toEqual([]);
    });

    it('preserves Entered (E) fields while allowing solver write-backs on C/N fields', () => {
      const p = sealedProject();
      p.box.boxType.set('vented');
      p.box.vented.volume_m3.set(0.03);
      p.box.vented.vent.diameter_m.set(0.05);
      p.box.vented.vent.endCorrection_m.set(0.6);

      // Human enters length (E)
      p.box.vented.vent.length_m.set(0.15);
      p.box.vented.tuning_goal_hz.clear();

      p.notifyVentChanged();

      // length_m must remain entered (E) and untouched by solver
      expect(p.box.vented.vent.length_m.entered).toBe(true);
      expect(p.box.vented.vent.length_m.value).toBe(0.15);

      // tuning_goal_hz must be calculated (C) by solver
      expect(p.box.vented.tuning_goal_hz.calculated).toBe(true);
      expect(p.box.vented.tuning_goal_hz.value).toBeGreaterThan(0);
    });

    it('transitions C -> N when required inputs are cleared', () => {
      const p = sealedProject();
      p.box.boxType.set('vented');
      p.box.vented.volume_m3.set(0.03);
      p.box.vented.vent.diameter_m.set(0.05);
      p.box.vented.vent.endCorrection_m.set(0.6);
      p.box.vented.tuning_goal_hz.set(35);

      p.notifyVentChanged();
      expect(p.box.vented.vent.length_m.calculated).toBe(true);

      // Clear a required input (the vent's size). Clearing the tuning would instead fall back to
      // the starting alignment (John, 2026-10-01), so the length would still solve.
      p.box.vented.vent.diameter_m.clear();
      p.notifyVentChanged();

      // length_m should transition from C -> N (not-available)
      expect(p.box.vented.vent.length_m.value).toBeNull();
    });

    it('ventAchievedFb is a ReadonlyField reporting the actual tuning frequency', () => {
      const p = ventedProject();
      p.box.vented.vent.shape.set('round');
      p.box.vented.vent.diameter_m.set(0.05);
      p.box.vented.vent.endCorrection_m.set(0.6);
      p.notifyVentChanged();

      expect(p.ventAchievedFb.calculated).toBe(true);
      const fb = p.ventAchievedFb.value;
      expect(fb).not.toBeNull();
      expect(Math.round(fb!)).toBe(35);
    });

    it('ventMaxReachableFb is a ReadonlyField reporting the L=0 tuning ceiling', () => {
      const p = ventedProject();
      p.box.vented.vent.shape.set('round');
      p.box.vented.vent.diameter_m.set(0.05);
      p.box.vented.vent.endCorrection_m.set(0.6);

      expect(p.ventMaxReachableFb.calculated).toBe(true);
      const maxFb = p.ventMaxReachableFb.value;
      expect(maxFb).not.toBeNull();
      expect(maxFb!).toBeGreaterThan(35);
    });

    it('an unreachable target writes null and a target-unreachable dq mark onto length_m', () => {
      const p = ventedProject();
      p.box.vented.vent.shape.set('round');
      p.box.vented.vent.diameter_m.set(0.05);
      p.box.vented.vent.endCorrection_m.set(0.6);
      p.box.vented.tuning_goal_hz.set(500); // impossible high target
      p.notifyVentChanged();

      expect(p.box.vented.vent.length_m.value).toBeNull();
      expect(p.box.vented.vent.length_m.dq.some(issue => issue.kind === 'target-unreachable')).toBe(true);
    });
});
