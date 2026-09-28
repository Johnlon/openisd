/**
 * `UIFieldSpec` states UI matters only — label, unit, pane, kind, description. What values a
 * field may hold, and how many decimals it means, are facts about the QUANTITY, not about the
 * input that edits it (John, 2026-09-28: "strip UIFieldSpec of all validity concerns and leave
 * only ui matters — it may access the abstract definition of the field from a field def in the
 * domain by containing a reference to that field def object").
 *
 * A number written in the registry is a second declaration of a domain fact, which is how
 * `PHYSICAL_RANGE`, `FIELD_FLOOR` and this registry drifted apart
 * (bugs/BUG_20260928_three_tables_disagree_on_field_validity.md). This is a TEXT search on the
 * registry source for the same reason the engine-door gate is: what is being tested is whether
 * a number was written there, not what it resolves to.
 */
import {describe, expect, it} from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';
import {Field} from '@openisd/design/fields';
import {UI_FIELD_SPECS, limits, precision} from '../../src/logic/fields/uiFields.js';

const registry = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)), '../../src/logic/fields/uiFields.ts');

describe('uiFields declares no validity of its own', () => {
  it('no row writes a min, a max or a precision', () => {
    const offences = fs.readFileSync(registry, 'utf8')
      .split('\n')
      .map((line, i) => ({line, n: i + 1}))
      .filter(({line}) => /^\s*(?!\*)(?:.*[,{]\s*)?(min|max|precision):/.test(line))
      .map(({line, n}) => `uiFields.ts:${n} ${line.trim().slice(0, 90)}`);
    expect(offences, 'a range or a decimal count is a fact about the quantity — declare it on '
      + "the field's own FieldDef in packages/design/fields and reference that here").toEqual([]);
  });

  it('every numeric row reaches its band and its decimals through a registry member', () => {
    const numeric = UI_FIELD_SPECS.filter(s => s.kind === 'number');
    expect(numeric.length).toBeGreaterThan(40);
    for (const spec of numeric) {
      expect(spec.def, `${spec.id} names no Field`).toBeInstanceOf(Field);
      expect(spec.def?.value, `${spec.id}'s Field is a different field`).toBe(spec.id);
    }
  });

  it('the registry enumerates every field, and ALL cannot fall behind the members', () => {
    // `ALL` is built by reflection, so a member declared without being listed is still in it.
    // This pins the other direction: the registry covers every numeric row the UI renders.
    const named = new Set(Field.ALL.map(f => f.value));
    const missing = UI_FIELD_SPECS.filter(s => s.kind === 'number' && !named.has(s.id))
      .map(s => s.id);
    expect(missing, 'the field registry does not enumerate these').toEqual([]);
    expect(Field.ALL.length).toBe(UI_FIELD_SPECS.filter(s => s.kind === 'number').length);
  });

  // The member name is code, `value` is what crosses a boundary — the same split `LossMode`
  // and `Chip` already use. This pins that the two are the same field, spelled for their two
  // audiences, so neither can drift on its own.
  it('every member is its value in SCREAMING_UPPER_CASE', () => {
    const screaming = (v: string): string => v.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
    const entries = Object.entries(Field).filter((e): e is [string, Field] => e[1] instanceof Field);
    expect(entries.length).toBe(Field.ALL.length);
    for (const [name, field] of entries) {
      expect(screaming(field.value), `Field.${name} carries '${field.value}'`).toBe(name);
    }
  });

  it('limits() and precision() still answer for a field that has both', () => {
    expect(limits('driver_Fs_hz')).toEqual({min: 1, max: 5000});
    expect(precision('driver_Fs_hz')).toBe(2);
  });
});
