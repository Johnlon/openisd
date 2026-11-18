import {describe, expect, it} from 'vitest';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {createEngine} from '../../engine/Engine.js';
import {PhoneBoxText} from '../../fields/phoneText.js';

/**
 * T902, bugs/BUG_20261118_dummy-radiator-sized-by-a-1x-rule-the-2x-line-contradicts.md: the starting placeholder
 * radiator is sized by the engine so that it meets the engine's own "2×" rule shown under it (John, 16 Nov 2026: the
 * radiators displace at least twice the driver array). The domain used to size it to 1× the array (at least twice one
 * driver's Xmax), so with 2 or 4 drivers the 2× line under the starting radiator asked for 2 of them.
 */
function w5(): OpenISDDriver {
  const d = OpenISDDriver.empty(createEngine());
  d.specs.Fs_hz.set(45);
  d.specs.Qes.set(0.57);
  d.specs.Qms.set(3.56);
  d.specs.Vas_m3.set(0.00485);
  d.specs.Re_ohm.set(3.4);
  d.specs.Sd_m2.set(0.0094);
  d.specs.Xmax_m.set(0.00925);
  return d;
}

describe('the starting dummy radiator meets the engine\'s 2× rule', () => {
  for (const n of [1, 2, 4]) {
    it(`${n} driver(s): the 2× line under the starting radiator says its radiators are enough`, () => {
      const engine = createEngine();
      const p = new ProjectBuilder(w5(), engine).sealed().volume_m3(0.01).build();
      p.nDrivers.set(n);
      p.box.boxType.set('box-passive-radiator');
      const pr = p.box.passiveRadiator;
      const spec = pr.radiator.spec;
      expect(pr.radiator.model.value).toBe('Dummy PR');

      const driverVd = p.driver.specs.Vd_m3.value;
      const prVd = engine.pr.displacement(spec.Sd_m2.value, spec.Xmax_m.value);
      const needed = engine.pr.countForTwiceDisplacement(prVd, driverVd, n);
      expect(needed).not.toBeNull();
      expect(needed!).toBeLessThanOrEqual(pr.count.value);
      expect(PhoneBoxText.twoTimesRule(engine.pr.twiceDriverDisplacement(driverVd, n)!, needed!)).toContain('1 of these is enough');
      // The radiator's own displacement is the one the engine gives for its Sd and Xmax.
      expect(spec.Vd_m3.value).toBe(prVd);
    });
  }
});
