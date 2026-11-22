import {describe, expect, it} from 'vitest';
import {sealedProject} from '../fixtures/domainBuilders.js';

/** Once FB goes too low and the port length gets a dq mark, raising FB must update the length without it being cleared first. */
describe('OpenISDProject vented tuning raised after an absurdly low tuning', () => {
  it('recomputes the port length from the raised tuning', () => {
    const p = sealedProject();
    p.box.boxType.set('vented');
    p.box.vented.volume_m3.set(0.03);
    p.box.vented.vent.diameter_m.set(0.05);
    p.box.vented.tuning_goal_hz.set(40);
    p.recalc();
    const at40 = p.box.vented.vent.length_m.value ?? 0;
    expect(at40).toBeGreaterThan(0);

    p.box.vented.tuning_goal_hz.set(1);
    p.recalc();
    expect(p.box.vented.vent.length_m.value).toBeGreaterThan(at40 * 100);

    p.box.vented.tuning_goal_hz.set(2);
    p.recalc();
    p.box.vented.tuning_goal_hz.set(40);
    p.recalc();
    expect(p.box.vented.vent.length_m.value).toBeCloseTo(at40, 6);
  });
});
