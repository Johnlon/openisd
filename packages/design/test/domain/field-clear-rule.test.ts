/**
 * docs/design/FIELD_CLEAR_RULE.md, one test per row of its Checks table plus the linked pairs
 * the bug file lists: clear the entered member, assert the states and values the rule gives.
 * A state is E entered, C calculated, N no value.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

interface Cell {
  readonly value: number | null;
  readonly entered: boolean;
  readonly calculated: boolean;
  set(v: number): void;
  clear(): void;
}

const letter = (c: Cell): 'E' | 'C' | 'N' => (c.value === null ? 'N' : c.entered ? 'E' : 'C');

const SPEC = {Fs_hz: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re_ohm: 6.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Vas_m3: 0.05, BL_Tm: 8, Mms_kg: 0.05};
const builder = () => {
  const engine = createEngine();
  return new ProjectBuilder(driverFromSpec(engine, SPEC), engine);
};

describe('clear rule: step 2, swap with the equation partner', () => {
  it('PR tuning cleared: tuning C, added mass E at its value', () => {
    const p = builder().passiveRadiator().volume_m3(0.03).build();
    const pr = p.box.passiveRadiator;
    pr.tuning_goal_hz.set(28);
    const mass = pr.addedMass_kg.value;
    expect(letter(pr.addedMass_kg)).toBe('C');
    pr.tuning_goal_hz.clear();
    expect(letter(pr.tuning_goal_hz)).toBe('C');
    expect(letter(pr.addedMass_kg)).toBe('E');
    expect(pr.addedMass_kg.value).toBe(mass);
    expect(pr.tuning_goal_hz.value).toBeCloseTo(28, 6);
  });

  it('PR added mass cleared: added mass C, tuning E at its value', () => {
    const p = builder().passiveRadiator().volume_m3(0.03).build();
    const pr = p.box.passiveRadiator;
    pr.addedMass_kg.set(0.04);
    const tuning = pr.tuning_goal_hz.value;
    expect(letter(pr.tuning_goal_hz)).toBe('C');
    pr.addedMass_kg.clear();
    expect(letter(pr.addedMass_kg)).toBe('C');
    expect(letter(pr.tuning_goal_hz)).toBe('E');
    expect(pr.tuning_goal_hz.value).toBe(tuning);
    expect(pr.addedMass_kg.value).toBeCloseTo(0.04, 6);
  });

  it('drive power cleared: power C, voltage E at its value', () => {
    const p = builder().sealed().volume_m3(0.03).build();
    p.powerDrive_W.set(4);
    const v = p.driveVoltage_V.value;
    p.powerDrive_W.clear();
    expect(letter(p.powerDrive_W)).toBe('C');
    expect(letter(p.driveVoltage_V)).toBe('E');
    expect(p.driveVoltage_V.value).toBe(v);
    expect(p.powerDrive_W.value).toBeCloseTo(4, 6);
  });

  it('drive voltage cleared: voltage C, power E at its value', () => {
    const p = builder().sealed().volume_m3(0.03).build();
    p.driveVoltage_V.set(4);
    const w = p.powerDrive_W.value;
    p.driveVoltage_V.clear();
    expect(letter(p.driveVoltage_V)).toBe('C');
    expect(letter(p.powerDrive_W)).toBe('E');
    expect(p.powerDrive_W.value).toBe(w);
    expect(p.driveVoltage_V.value).toBeCloseTo(4, 6);
  });

  it('port diameter cleared: diameter C, area E at its value', () => {
    const p = builder().vented().volume_m3(0.05).tuning_goal_hz(30).build();
    const vent = p.box.vented.vent;
    vent.shape.set('round');
    vent.diameter_m.set(0.06);
    const area = vent.area_m2.value;
    vent.diameter_m.clear();
    expect(letter(vent.diameter_m)).toBe('C');
    expect(letter(vent.area_m2)).toBe('E');
    expect(vent.area_m2.value).toBe(area);
    expect(vent.diameter_m.value).toBeCloseTo(0.06, 6);
  });

  it('port area cleared: area C, diameter E at its value', () => {
    const p = builder().vented().volume_m3(0.05).tuning_goal_hz(30).build();
    const vent = p.box.vented.vent;
    vent.shape.set('round');
    vent.area_m2.set(0.004);
    const d = vent.diameter_m.value;
    vent.area_m2.clear();
    expect(letter(vent.area_m2)).toBe('C');
    expect(letter(vent.diameter_m)).toBe('E');
    expect(vent.diameter_m.value).toBe(d);
    expect(vent.area_m2.value).toBeCloseTo(0.004, 6);
  });

  it('slot height cleared: height C, area E at its value', () => {
    const p = builder().vented().volume_m3(0.05).tuning_goal_hz(30).build();
    const vent = p.box.vented.vent;
    vent.shape.set('slotted');
    vent.width_m.set(0.1);
    vent.height_m.set(0.03);
    const area = vent.area_m2.value;
    vent.height_m.clear();
    expect(letter(vent.height_m)).toBe('C');
    expect(letter(vent.area_m2)).toBe('E');
    expect(vent.area_m2.value).toBe(area);
  });

  it('sealed Qtc cleared: Qtc C, volume E at its value', () => {
    const p = builder().sealed().volume_m3(0.03).build();
    p.box.sealed.q_tc.set(0.8);
    const vb = p.box.sealed.volume_m3.value;
    p.box.sealed.q_tc.clear();
    expect(letter(p.box.sealed.q_tc)).toBe('C');
    expect(letter(p.box.sealed.volume_m3)).toBe('E');
    expect(p.box.sealed.volume_m3.value).toBe(vb);
  });

  it('sealed volume cleared: volume C, Qtc E at its value', () => {
    const p = builder().sealed().volume_m3(0.03).build();
    const qtc = p.box.sealed.q_tc.value;
    expect(letter(p.box.sealed.volume_m3)).toBe('E');
    p.box.sealed.volume_m3.clear();
    expect(letter(p.box.sealed.volume_m3)).toBe('C');
    expect(letter(p.box.sealed.q_tc)).toBe('E');
    expect(p.box.sealed.q_tc.value).toBe(qtc);
    expect(p.box.sealed.volume_m3.value).toBeCloseTo(0.03, 2);
  });
});

describe('clear rule on a passive radiator', () => {
  it('a cleared target tuning with no added mass stated is calculated, never blank', () => {
    const p = builder().passiveRadiator().volume_m3(0.03).build();
    const pr = p.box.passiveRadiator;
    pr.addedMass_kg.clear();
    pr.tuning_goal_hz.set(25);
    pr.tuning_goal_hz.clear();
    expect(pr.tuning_goal_hz.value).not.toBeNull();
    expect(letter(pr.tuning_goal_hz)).toBe('C');
    expect(letter(pr.addedMass_kg)).toBe('E');
  });
});

describe('clear rule: step 1 and 3', () => {
  it('driver Mms cleared with Fs and Cms entered: Mms C', () => {
    const p = builder().sealed().volume_m3(0.03).build();
    p.driver.specs.Mms_kg.clear();
    expect(letter(p.driver.specs.Mms_kg)).toBe('C');
    expect(p.driver.specs.Mms_kg.value).toBeCloseTo(1 / ((2 * Math.PI * 30) ** 2 * 0.0005), 9);
  });

  it('counts go to 1 C, Rg to 0.1 C', () => {
    const p = builder().sealed().volume_m3(0.03).build();
    p.nDrivers.set(3);
    p.nDrivers.clear();
    expect(p.nDrivers.value).toBe(1);
    p.box.passiveRadiator.count.set(3);
    p.box.passiveRadiator.count.clear();
    expect(p.box.passiveRadiator.count.value).toBe(1);
    p.Rs_ohm.set(4);
    p.Rs_ohm.clear();
    expect(p.Rs_ohm.value).toBe(0.1);
  });
});
