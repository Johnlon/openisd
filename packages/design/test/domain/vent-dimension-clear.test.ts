import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

/** A cleared port dimension on the vented box never stays blank (John, 2026-10-09,
 *  bugs/BUG_20261009_pr-added-mass-can-be-cleared-to-blank.md): diameter, height and area settle to
 *  the starting port (50 mm round, or a slot sized from the driver); the width goes back to the
 *  driver's Dd. */
describe('clearing a vented port dimension', () => {
  const project = () => {
    const engine = createEngine();
    return new ProjectBuilder(
      driverFromSpec(engine, { Fs_hz: 30, Qes: 0.4, Qms: 4, Sd_m2: 0.02, Cms_m_per_N: 0.0005 }), engine)
      .vented().volume_m3(0.03).tuning_goal_hz(30).build();
  };

  it('a cleared diameter is entered 50 mm, the area calculated from it', () => {
    const vent = project().box.vented.vent;
    vent.diameter_m.set(0.1);

    vent.diameter_m.clear();

    expect(vent.diameter_m.entered).toBe(true);
    expect(vent.diameter_m.value).toBe(0.05);
    expect(vent.area_m2.entered).toBe(false);
  });

  it('a cleared entered area on a round port settles to a 50 mm diameter', () => {
    const vent = project().box.vented.vent;
    vent.area_m2.set(0.01);

    vent.area_m2.clear();

    expect(vent.diameter_m.entered).toBe(true);
    expect(vent.diameter_m.value).toBe(0.05);
    expect(vent.area_m2.entered).toBe(false);
  });

  it('a cleared height on a slotted port settles to the starting slot height', () => {
    const p = project();
    const vent = p.box.vented.vent;
    vent.shape.set('slotted');
    vent.width_m.set(0.2);
    vent.height_m.set(0.05);

    vent.height_m.clear();

    expect(vent.height_m.entered).toBe(true);
    expect(vent.height_m.value).toBe(0.03);
    expect(vent.width_m.value).toBe(0.2);
  });

  it('a cleared width is the driver\'s Dd, entered', () => {
    const p = project();
    const vent = p.box.vented.vent;
    vent.shape.set('slotted');
    vent.width_m.set(0.2);
    const Dd = p.driver.specs.Dd_m.value;
    expect(Dd).not.toBeNull();

    vent.width_m.clear();

    expect(vent.width_m.entered).toBe(true);
    expect(vent.width_m.value).toBe(Dd);
  });
});
