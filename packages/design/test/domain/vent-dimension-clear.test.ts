import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

/** A cleared port dimension on the vented box never stays blank. John, 2026-10-16: clearing the
 *  diameter, height or area keeps the partner at its value as E and the cleared one is calculated
 *  (replaces the 2026-10-09 ruling that sent it to the 50 mm starting port, which is now only the
 *  fallback when the partner has no value). The width goes back to the driver's Dd. */
describe('clearing a vented port dimension', () => {
  const project = () => {
    const engine = createEngine();
    return new ProjectBuilder(
      driverFromSpec(engine, { Fs_hz: 30, Qes: 0.4, Qms: 4, Sd_m2: 0.02, Cms_m_per_N: 0.0005 }), engine)
      .vented().volume_m3(0.03).tuning_goal_hz(30).build();
  };

  it('a cleared diameter keeps the area at its value, entered; the diameter is calculated (John, 2026-10-16)', () => {
    const vent = project().box.vented.vent;
    vent.diameter_m.set(0.1);
    const area = vent.area_m2.value;

    vent.diameter_m.clear();

    expect(vent.area_m2.entered).toBe(true);
    expect(vent.area_m2.value).toBe(area);
    expect(vent.diameter_m.entered).toBe(false);
    expect(vent.diameter_m.value).toBeCloseTo(0.1, 9);
  });

  it('a cleared entered area on a round port keeps the diameter, entered; the area is calculated', () => {
    const vent = project().box.vented.vent;
    vent.area_m2.set(0.01);
    const diameter = vent.diameter_m.value;

    vent.area_m2.clear();

    expect(vent.diameter_m.entered).toBe(true);
    expect(vent.diameter_m.value).toBe(diameter);
    expect(vent.area_m2.entered).toBe(false);
  });

  it('a cleared height on a slotted port keeps the area, entered; the height is calculated', () => {
    const p = project();
    const vent = p.box.vented.vent;
    vent.shape.set('slotted');
    vent.width_m.set(0.2);
    vent.height_m.set(0.05);
    const area = vent.area_m2.value;

    vent.height_m.clear();

    expect(vent.area_m2.entered).toBe(true);
    expect(vent.area_m2.value).toBe(area);
    expect(vent.height_m.entered).toBe(false);
    expect(vent.height_m.value).toBeCloseTo(0.05, 9);
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
