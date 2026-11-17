import {describe, expect, it} from 'vitest';
import {sealedProject} from '../fixtures/domainBuilders.js';

/** John, 17 Nov 2026: "once FB goes to low and we get dq and port len is ridiculous then raising FB the Len does
 *  not respond until I clear it". */
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
