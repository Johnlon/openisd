/**
 * The field registry is the ONE place a field is described: its name, label, unit, band and
 * decimals. There used to be four — `FIELD_FLOOR`, `PHYSICAL_RANGE`, the UI's own field table
 * and NumInput's props — and they drifted apart on nine fields
 * (bugs/archive/BUG_20260928_three_tables_disagree_on_field_validity.md).
 *
 * These gates pin the properties that stop it splitting again: no member may be absent from
 * `ALL_FIELDS`, no two members may claim the same field, and a member's NAME must be its
 * VALUE, so the two spellings cannot drift.
 */
import {describe, expect, it} from 'vitest';
import {
  ALL_FIELDS, DateField, EnumField, Field, NumberField, TextField, ToggleField,
} from '@openisd/design/fields';

const KINDS = [NumberField, EnumField, TextField, ToggleField, DateField];

describe('the field registry', () => {
  it('enumerates every member — a member cannot be left out of ALL_FIELDS', () => {
    // Each class builds its own `ALL` by reflection, so declaring a member is enough to be in
    // it. This pins the other direction: the aggregate lists every class's members.
    const declared = KINDS.flatMap(k =>
      Object.values(k).filter((v): v is Field => v instanceof Field));
    expect(new Set(ALL_FIELDS).size).toBe(ALL_FIELDS.length);
    expect(new Set(ALL_FIELDS)).toEqual(new Set(declared));
  });

  it('names each field once — no two members claim the same field', () => {
    const seen = new Map<string, string[]>();
    for (const k of KINDS) {
      for (const [name, f] of Object.entries(k)) {
        if (f instanceof Field) seen.set(f.value, [...(seen.get(f.value) ?? []), name]);
      }
    }
    const clashes = [...seen].filter(([, names]) => names.length > 1);
    expect(clashes, 'two members carry the same field name').toEqual([]);
  });

  // The member name is code, `value` is what crosses a boundary. This pins that the two are
  // the same field spelled for their two audiences, so neither can drift on its own.
  it('spells every member as its value in SCREAMING_UPPER_CASE', () => {
    const screaming = (v: string): string => v.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
    for (const k of KINDS) {
      for (const [name, f] of Object.entries(k)) {
        if (f instanceof Field) {
          expect(screaming(f.value), `${k.name}.${name} carries '${f.value}'`).toBe(name);
        }
      }
    }
  });

  it('gives every field a label and a description', () => {
    const bare = ALL_FIELDS.filter(f => f.label === '' || f.description.length < 20)
      .map(f => f.value);
    expect(bare, 'a field with no label or no tooltip text').toEqual([]);
  });

  it('states a usable band on every number — min below max, decimals not negative', () => {
    const bad = NumberField.ALL
      .filter(f => !(f.limits.min < f.limits.max) || f.precision < 0)
      .map(f => `${f.value} ${JSON.stringify(f.limits)} dp=${f.precision}`);
    expect(bad).toEqual([]);
  });

  it('offers a non-empty option list on every enum', () => {
    expect(EnumField.ALL.filter(f => f.options.length === 0).map(f => f.value)).toEqual([]);
  });

  it('lists the whole band as options for a count', () => {
    expect(NumberField.VENT_COUNT.countOptions().map(o => o.value)).toEqual([1, 2, 3, 4]);
  });
});
