/**
 * A value is never cut (rule 11, John, 10 Nov 2026; "running off the edge is bad", 5 Nov). The phone
 * Signal tab's boxes hold `PhoneRowColumns.signalInputChars()` characters ("100000.00"). The System input
 * power that drives the 10 mV minimum (a drive level repaired on opening, T918) is about 0.00002857 W:
 * with four figures its fixed form is 10 characters and ran past the phone box. On the phone it is shown
 * in exponent form, still four figures; the desktop box, which is wider, keeps the fixed form.
 */
import {describe, expect, it} from 'vitest';
import {NumberField, PHONE_MAX_SIGNIFICANT, PhoneRowColumns} from '../../fields/index.js';
import {createEngine} from '../../engine/Engine.js';

const engine = createEngine();
const POWER = NumberField.SIGNAL_PIN_W;
/** The power one driver of `re` ohms draws at the 10 mV minimum, through 0.1 ohm (the W5 project's Rg). */
const powerAt10mV = (re: number) => engine.signal.powerFor(0.01, 1, 'parallel', re, 0.1, true);

describe('the System input power at the 10 mV minimum fits the phone Signal box', () => {
  for (const re of [3.4, 8, 64, 1000]) {
    it(`Re ${re} ohm: the phone shows it whole, in four figures, and it reads back as the same value`, () => {
      const P = powerAt10mV(re);
      const shown = POWER.format(P, null, undefined, PHONE_MAX_SIGNIFICANT);
      expect(shown.length).toBeLessThanOrEqual(PhoneRowColumns.signalInputChars());
      const read = POWER.parseEntry(shown);
      if (read.kind !== 'quantity') throw new Error(`${shown} does not read back as a number`);
      expect(read.valueSI / P).toBeCloseTo(1, 3);
    });
  }

  it('the W5 project (Re 3.4 ohm at its coil temperature) shows 2.857e-5 on the phone and 0.00002857 on the desktop', () => {
    expect(POWER.format(2.857e-5, null, undefined, PHONE_MAX_SIGNIFICANT)).toBe('2.857e-5');
    expect(POWER.format(2.857e-5)).toBe('0.00002857');
  });

  it('a value whose fixed form fits keeps it on the phone', () => {
    expect(POWER.format(0.0001234, null, undefined, PHONE_MAX_SIGNIFICANT)).toBe('0.0001234');
    expect(POWER.format(1, null, undefined, PHONE_MAX_SIGNIFICANT)).toBe('1.00');
    expect(POWER.format(100000, null, undefined, PHONE_MAX_SIGNIFICANT)).toBe('100000.00');
  });
});
