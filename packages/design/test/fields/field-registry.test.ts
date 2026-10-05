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
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';
import {VoiceCoilWiring} from '../../domain/index.js';
import {
  ALL_FIELDS, DateField, EnumField, Field, NumberField, TextField, ToggleField,
} from '../../fields/index.js';

const KINDS = [NumberField, EnumField, TextField, ToggleField, DateField];

describe('field-registry — the field registry', () => {
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
});

/**
 * Every dropdown lists its choices from ONE option list on its `EnumField`, in the one
 * `SelectorOption` shape (`value`/`label`), and that list is the domain's own
 * (PLAN_FIELD_REGISTRY_DESCRIPTIONS_AND_SSOT.md §6).
 */
function optionsOf(field: EnumField) {
  assert.ok(field.options.length > 0, `${field.value} carries no options`);
  for (const o of field.options) {
    assert.deepEqual(Object.keys(o).sort(), ['label', 'value'],
      `${field.value} option is not a SelectorOption: ${JSON.stringify(o)}`);
  }
  return field.options;
}

describe('every dropdown is an EnumField carrying SelectorOption[]', () => {
  it('vent_Shape lists round and slotted', () => {
    assert.deepEqual(optionsOf(EnumField.VENT_SHAPE).map(o => o.value), ['round', 'slotted']);
  });

  it('driver_VCCon values ARE the domain wiring values, so a chosen option can be written straight to the driver', () => {
    assert.deepEqual(optionsOf(EnumField.VCCON).map(o => o.value), [VoiceCoilWiring.Parallel, VoiceCoilWiring.Series]);
  });

  it('driver_ArrayWiring lists parallel and series', () => {
    assert.deepEqual(optionsOf(EnumField.DRIVER_ARRAYWIRING).map(o => o.value), ['parallel', 'series']);
  });

  it('box_Type lists every enclosure type the Box tab offers, simulatable or not', () => {
    assert.deepEqual(optionsOf(EnumField.BOX_TYPE).map(o => o.value),
      ['sealed', 'vented', 'box-passive-radiator', 'bandpass4', 'bandpass6', 'abc']);
  });

  it('box_Qtc lists the nine WinISD sealed alignments and is the SAME list the engine hands out', () => {
    const options = optionsOf(EnumField.BOX_QTC);
    assert.equal(options.length, 9);
    assert.deepEqual(options, createEngine().sealed.alignmentOptions());
  });

  it('filter_Type lists every WinISD filter type plus the two OpenISD-only shelves', () => {
    assert.deepEqual(optionsOf(EnumField.FILTER_TYPE).map(o => o.value),
      ['lowpass', 'highpass', 'allpass', 'linkwitz', 'peaking', 'peakHighpass', 'staticGain', 'raisedCosine', 'lowshelf', 'highshelf']);
  });
});

describe('a count select lists every integer the field allows, as SelectorOption[]', () => {
  it('driver_nDrivers offers 1..64, the spec\'s own min..max', () => {
    const options = NumberField.DRIVER_NDRIVERS.countOptions();
    assert.equal(options.length, 64);
    assert.deepEqual(options[0], {value: 1, label: '1'});
    assert.deepEqual(options[63], {value: 64, label: '64'});
  });

  it('vent_Count offers 1..4 ports, carries WinISD\'s Num alias and a description', () => {
    const options = NumberField.VENT_COUNT.countOptions();
    assert.deepEqual(options.map(o => o.value), [1, 2, 3, 4]);
    assert.equal(NumberField.VENT_COUNT.precision, 0);
    assert.ok(NumberField.VENT_COUNT.description.length > 20);
  });
});

