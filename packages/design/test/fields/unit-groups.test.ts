/**
 * Resistance and percent unit groups (`UNIT_GROUPS`): what a toggle may change.
 *
 * Resistance: Ns/m and kg/s are the same dimension, so a real conversion factor would silently
 * change the number the toggle is only meant to relabel (ledger QO51). Percent: one unit, the
 * ONE place a fraction becomes a percentage. Whether the driver editor template binds these
 * groups is checked in ui/test/architecture/driver-editor-template.test.ts.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {NumberField, toDisplay as toDispCore, UNIT_GROUPS, unitFor, type UnitGroup} from '../../fields/index.js';

const toDisplay = (val: number, group: UnitGroup, token: string) => toDispCore(unitFor(group, token), val);
const nextToken = (group: UnitGroup, token: string) => { const grp = UNIT_GROUPS[group]; const idx = grp.findIndex(u => u.token === token); return grp[(idx + 1) % grp.length].token; };
const RESISTANCE_FIELDS = [
  NumberField.RMS_KG_PER_S, NumberField.RME_KG_PER_S, NumberField.MCOST_KG_PER_S,
] as const;

describe('resistance unit group — Ns/m ↔ kg/s, factor 1', () => {
  it('units.ts defines a resistance group offering exactly WinISD\'s two spellings, both SI × 1', () => {
    const defs = UNIT_GROUPS.resistance;
    assert.ok(defs, 'no "resistance" group in UNIT_GROUPS');
    assert.deepEqual(defs.map(d => d.label).sort(), ['Ns/m', 'kg/s']);
    for (const d of defs) {
      assert.equal(d.factor, 1, `${d.label} must be SI × 1 — Ns/m and kg/s are the same dimension, so a real ` +
        'conversion factor here would silently change the number the toggle is only meant to relabel');
    }
  });

  it('Rms, Rme and Mcost declare the resistance group on their display', () => {
    for (const f of RESISTANCE_FIELDS) {
      assert.equal(f.display.kind, 'switchable', `${f.value} is not a switchable display`);
      assert.equal(f.display.kind === 'switchable' ? f.display.group : null, 'resistance',
        `${f.value} does not carry display.group: 'resistance'`);
    }
  });

  it('every token in the resistance group renders the identical number — a toggle can only change the label', () => {
    const sample = 12.5;   // neutral value — no claim about any driver's real Rms/Rme/Mcost
    for (const d of UNIT_GROUPS.resistance) {
      assert.equal(toDisplay(sample, 'resistance', d.token), sample,
        `switching to "${d.label}" changed ${sample} — the group's factor must be 1 for every token`);
    }
  });
});

describe('percent unit group — one unit, the ONE place a fraction becomes a percentage', () => {
  it('units.ts defines a percent group holding exactly one unit, "%", at SI × 100', () => {
    const defs = UNIT_GROUPS.percent;
    assert.ok(defs, 'no "percent" group in UNIT_GROUPS');
    assert.equal(defs.length, 1, 'a percentage has one spelling — a second entry would imply a conversion that does not exist');
    assert.equal(defs[0].label, '%');
    assert.equal(defs[0].factor, 100, 'a stored FRACTION renders as a percentage: 0.0231… → 2.31…');
    assert.equal(defs[0].offset ?? 0, 0, 'a percentage is purely multiplicative — an offset here would bend every value');
  });

  it('rotating a one-unit group is a no-op, so the toggle cannot change the number', () => {
    const only = UNIT_GROUPS.percent[0].token;
    assert.equal(nextToken('percent', only), only,
      'nextToken must return the same token — a single-unit group has nowhere to rotate to');
  });

  it('no and Gloss declare the percent group on their display', () => {
    for (const f of [NumberField.NO, NumberField.GLOSS]) {
      assert.equal(f.display.kind, 'switchable', `${f.value} is not a switchable display`);
      assert.equal(f.display.kind === 'switchable' ? f.display.group : null, 'percent',
        `${f.value} does not carry display.group: 'percent'`);
    }
  });
});
