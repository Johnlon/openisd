import {describe, expect, it} from 'vitest';
import {OpenISDDriver, ProjectBuilder} from '../../domain/index.js';
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
