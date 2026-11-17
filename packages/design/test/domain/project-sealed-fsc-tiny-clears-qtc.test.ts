import {describe, expect, it} from 'vitest';
import {sealedProject} from '../fixtures/domainBuilders.js';

/** bugs/BUG_20261117_sealed-qtc-keeps-old-value-when-fsc-is-tiny.md: typing Fsc 82.53 then a tiny Fsc left Qtc
 *  showing the old calculated value; a clean project with only the tiny Fsc shows Qtc blank. */
describe('OpenISDProject sealed Fsc typed tiny after a normal Fsc', () => {
  it('leaves Qtc as blank as in a project where only the tiny Fsc was typed', () => {
    const p = sealedProject();
    p.box.sealed.resonance_hz.set(82.53);
    p.recalc();
    expect(p.box.sealed.q_tc.value).not.toBeNull();

    p.box.sealed.resonance_hz.set(0.06602);
    p.recalc();

    const clean = sealedProject();
    clean.box.sealed.resonance_hz.set(0.06602);
    clean.recalc();
    expect(clean.box.sealed.q_tc.value).toBeNull();
    expect(p.box.sealed.volume_m3.value).toBeNull();
    expect(p.box.sealed.q_tc.value).toBeNull();
  });
});
