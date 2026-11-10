/**
 * A number box shows plain numbers with at least 4 significant figures and never drops a whole-number digit
 * (John, 10 Nov 2026, board, option B: 101325 Pa, 1.201 kg/m3, 0.3687 mm/N, 0.0003687 m/N, 293.2 K; no scientific notation).
 */
import {describe, expect, it} from 'vitest';
import {NumberField} from '../../fields/field.js';
import {UNIT_GROUPS} from '../../fields/dimensions.js';

const SHOWN_VALUES = [1.2345, 12.345, 123.45, 1234.5, 101325.4, 0.36874, 0.036874, 0.0036874, 0.00036874, 0.000036874];

function tokensOf(field: NumberField): (string | undefined)[] {
  return field.display.kind === 'switchable' ? UNIT_GROUPS[field.display.group].map(unit => unit.token) : [undefined];
}

describe('every number box shows at least 4 significant figures', () => {
  for (const field of NumberField.ALL) {
    for (const token of tokensOf(field)) {
      it(`${field.label} in ${token ?? 'its fixed unit'}`, () => {
        for (const shown of SHOWN_VALUES) {
          const text = field.format(field.toSI(shown, token), null, token, undefined);
          expect(text, `${shown} shown as ${text}`).toMatch(/^-?\d+(\.\d+)?$/);
          expect(Math.abs(Number(text) - shown) / shown, `${shown} shown as ${text}`).toBeLessThan(5.01e-4);
        }
      });
    }
  }
});
