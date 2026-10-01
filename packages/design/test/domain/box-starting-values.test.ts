/**
 * A box type gets starting values the first time it is used with nothing entered: the values
 * the New Project wizard writes for a fresh project of that type. One implementation,
 * `OpenISDBox.applyStartingValues()`, reached by `boxType.set()` and by every `ProjectBuilder`
 * at build. Nothing already entered is overwritten
 * (BUG_20260929_box-type-switch-leaves-volume-zero).
 */
import {describe, expect, it} from 'vitest';
import {OpenISDDriver, OpenISDProject, ProjectBuilder} from '../../domain/index.js';
import {createEngine} from '../../engine/index.js';
import {DEFAULT_SOURCE_RESISTANCE_OHM} from '../../fields/defaults.js';

function driver(): OpenISDDriver {
  const d = OpenISDDriver.empty(createEngine());
  d.specs.Fs_hz.set(40);
  d.specs.Qes.set(0.4);
  d.specs.Qms.set(4);
  d.specs.Vas_m3.set(0.02);
  d.specs.Re_ohm.set(6.4);
  d.specs.Sd_m2.set(0.021);
  d.specs.Xmax_m.set(0.008);
  d.specs.Dd_m.set(0.13);
  return d;
}

function sealedProject(): OpenISDProject {
  return new ProjectBuilder(driver(), createEngine()).sealed().volume_m3(0.03).build();
}

describe('box starting values on a type switch', () => {
  it('sealed: the flat (Qtc 0.707) volume', () => {
    const p = new ProjectBuilder(driver(), createEngine()).vented().volume_m3(0.03).tuning_goal_hz(35).build();
    p.box.boxType.set('sealed');
    expect(p.box.sealed.volume_m3.value).toBe(p.driver.sealedVolumeForQtc(0.707));
  });

  it('vented: the QB3 design for the source-loaded Qts, a 50 mm vent', () => {
    const p = sealedProject();
    p.box.boxType.set('vented');
    const design = p.driver.ventedDesign('qb3', DEFAULT_SOURCE_RESISTANCE_OHM, p.box.vented.losses.Ql.value)!;
    expect(p.box.vented.volume_m3.value).toBe(design.Vb);
    expect(p.box.vented.tuning_goal_hz.value).toBe(design.Fb);
    expect(p.box.vented.vent.diameter_m.value).toBe(0.05);
  });

  // John, 2026-10-01: "added mass to cone should be 0 for pr" — the tuning follows from it.
  it('passive radiator: 7 L, no added mass, a placeholder radiator sized off the driver', () => {
    const p = sealedProject();
    p.box.boxType.set('box-passive-radiator');
    const pr = p.box.passiveRadiator;
    expect(pr.volume_m3.value).toBe(0.007);
    expect(pr.addedMass_kg.value).toBe(0);
    expect(pr.addedMass_kg.entered).toBe(true);
    expect(pr.tuning_goal_hz.entered).toBe(false);
    expect(pr.radiator.brand.value).toBe('Placeholder');
    expect(pr.radiator.model.value).toBe('ReplaceMe');
    expect(pr.radiator.spec.Sd_m2.value).toBe(0.021);        // the driver's own Sd
    expect(pr.radiator.spec.Xmax_m.value).toBe(0.016);       // twice the driver's Xmax
    expect(pr.radiator.spec.Cms_m_per_N.value).toBe(0.0005);
    expect(pr.radiator.spec.Mms_kg.value).toBe(0.05);
  });

  it('passive radiator with a driver stating no Sd/Xmax: the flat 20 cm² Sd, no Xmax', () => {
    const p = ProjectBuilder.empty(createEngine());
    p.box.boxType.set('box-passive-radiator');
    expect(p.box.passiveRadiator.radiator.spec.Sd_m2.value).toBe(0.02);
    expect(p.box.passiveRadiator.radiator.spec.Xmax_m.value).toBeNull();
  });

  it('vented with a slotted vent: width is the driver diameter, height 3 cm; 10 cm width without a diameter', () => {
    const p = sealedProject();
    p.box.vented.vent.shape.set('slotted');
    p.box.boxType.set('vented');
    expect(p.box.vented.vent.width_m.value).toBe(0.13);
    expect(p.box.vented.vent.height_m.value).toBe(0.03);
    const q = ProjectBuilder.empty(createEngine());
    q.box.vented.vent.shape.set('slotted');
    q.box.boxType.set('vented');
    expect(q.box.vented.vent.width_m.value).toBe(0.1);
  });

  it('bandpass4: 7 L rear, 10 L front tuned to 35 Hz through a 50 mm vent', () => {
    const p = sealedProject();
    p.box.boxType.set('bandpass4');
    expect(p.box.bandpass4.chambers.rear.volume_m3.value).toBe(0.007);
    expect(p.box.bandpass4.chambers.front.volume_m3.value).toBe(0.01);
    expect(p.box.bandpass4.chambers.front.tuning_goal_hz.value).toBe(35);
    expect(p.box.bandpass4.vents.front.diameter_m.value).toBe(0.05);
  });

  it('an entered volume is never overwritten', () => {
    const p = sealedProject();
    p.box.vented.volume_m3.set(0.05);
    p.box.boxType.set('vented');
    expect(p.box.vented.volume_m3.value).toBe(0.05);
  });

  it('a driver without Qts/Vas gives no sealed or vented starting value', () => {
    const p = ProjectBuilder.empty(createEngine());
    p.box.boxType.set('vented');
    expect(p.box.vented.volume_m3.value).toBe(0);
    p.box.boxType.set('sealed');
    expect(p.box.sealed.volume_m3.value).toBe(0);
  });
});

describe('ProjectBuilder starting values', () => {
  it('sealed() without a volume builds the flat volume', () => {
    const p = new ProjectBuilder(driver(), createEngine()).sealed().build();
    expect(p.box.sealed.volume_m3.value).toBe(p.driver.sealedVolumeForQtc(0.707));
    expect(p.isModified()).toBe(false);
  });

  it('vented().alignment(a) designs for the named alignment; without one, QB3', () => {
    const p = new ProjectBuilder(driver(), createEngine()).vented().alignment('bb4').build();
    const design = p.driver.ventedDesign('bb4', DEFAULT_SOURCE_RESISTANCE_OHM, p.box.vented.losses.Ql.value)!;
    expect(p.box.vented.volume_m3.value).toBe(design.Vb);
    expect(p.box.vented.tuning_goal_hz.value).toBe(design.Fb);
    expect(p.box.vented.vent.diameter_m.value).toBe(0.05);
    const q = new ProjectBuilder(driver(), createEngine()).vented().build();
    expect(q.box.vented.volume_m3.value).toBe(p.driver.ventedDesign('qb3', DEFAULT_SOURCE_RESISTANCE_OHM, q.box.vented.losses.Ql.value)!.Vb);
  });

  it('passiveRadiator() without a radiator builds the chart-ready one', () => {
    const p = new ProjectBuilder(driver(), createEngine()).passiveRadiator().build();
    expect(p.box.passiveRadiator.volume_m3.value).toBe(0.007);
    expect(p.box.passiveRadiator.radiator.spec.Mms_kg.value).toBe(0.05);
  });

  it('empty() stays at zero volumes: a blank driver has nothing to design from', () => {
    const p = ProjectBuilder.empty(createEngine());
    expect(p.box.sealed.volume_m3.value).toBe(0);
  });
});
