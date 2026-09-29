/**
 * A number field states its display unit once: `display` is either `fixed` (one symbol) or
 * `switchable` (a `UnitGroup` plus that group's own base token) — never a separate `unit` string
 * alongside a separate `unitGroup` that a call site's `base=` could contradict. Second follow-up
 * of bugs/BUG_20260928_three_tables_disagree_on_field_validity.md.
 */
import {describe, expect, it} from 'vitest';
import {NumberField} from '../../fields/field.js';
import {UNIT_GROUPS} from '../../fields/dimensions.js';

describe('a number field states its display unit once', () => {
  it('every field is fixed or switchable, never neither', () => {
    for (const f of NumberField.ALL) {
      expect(['fixed', 'switchable']).toContain(f.display.kind);
    }
  });

  it("a switchable field's base is one of its group's own tokens", () => {
    for (const f of NumberField.ALL) {
      if (f.display.kind !== 'switchable') continue;
      const tokens = UNIT_GROUPS[f.display.group].map(u => u.token);
      expect(tokens).toContain(f.display.base);
    }
  });

  it("a switchable field's label comes from UNIT_GROUPS, never a second string", () => {
    const fs = NumberField.FS_HZ.display;
    if (fs.kind !== 'switchable') throw new Error('FS_HZ must be switchable');
    expect(fs.group).toBe('freq');
    expect(fs.base).toBe('Hz');
    const label = UNIT_GROUPS[fs.group].find(u => u.token === fs.base)?.label;
    expect(label).toBe('Hz');
  });

  it('Vas is switchable in the volume group, base L — not the stale lowercase "l"', () => {
    const vas = NumberField.VAS_M3.display;
    if (vas.kind !== 'switchable') throw new Error('VAS_M3 must be switchable');
    expect(vas.group).toBe('volume');
    expect(vas.base).toBe('L');
  });

  it('a dimensionless quantity (Qts) is fixed with an empty symbol', () => {
    const qts = NumberField.QTS.display;
    if (qts.kind !== 'fixed') throw new Error('QTS must be fixed');
    expect(qts.symbol).toBe('');
  });

  it('a field with a real but never-switched unit (Re, ohms) is fixed to that symbol', () => {
    const re = NumberField.RE_OHM.display;
    if (re.kind !== 'fixed') throw new Error('RE_OHM must be fixed');
    expect(re.symbol).toBe('ohm');
  });
});
