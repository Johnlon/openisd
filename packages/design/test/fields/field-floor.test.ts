/**
 * A number field carries its own floor, beside its two bands — whether zero and negatives are
 * admissible at all, which neither `limits` nor `plausible` answers (`Qts` has a `limits` floor
 * of 0 and a floor of 'positive'). Third of the three tables in
 * bugs/BUG_20260928_three_tables_disagree_on_field_validity.md.
 *
 * `driver-value-validity.test.ts` pins the BEHAVIOUR field by field; this pins where the fact
 * now lives, so a floor stated on the field and a floor the driver applies cannot drift apart.
 */
import {describe, expect, it} from 'vitest';
import {NumberField} from '../../fields/field.js';

describe('a number field states its own floor', () => {
  it('a magnitude is strictly positive', () => {
    expect(NumberField.FS_HZ.floor).toBe('positive');
    expect(NumberField.QTS.floor).toBe('positive');
  });

  it('a quantity that is legitimately zero but never negative is non-negative', () => {
    expect(NumberField.LE_H.floor).toBe('non-negative');
    expect(NumberField.ZNOM_OHM.floor).toBe('non-negative');
  });

  it('a decibel LEVEL relative to a reference has no floor', () => {
    expect(NumberField.SPL_DB.floor).toBe('none');
  });

  it("defaults to 'none' — a field states a floor only where one is known", () => {
    for (const f of NumberField.ALL) {
      expect(['positive', 'non-negative', 'none']).toContain(f.floor);
    }
  });
});
