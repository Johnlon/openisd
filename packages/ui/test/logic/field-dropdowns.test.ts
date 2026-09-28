/**
 * Every dropdown the shell renders lists its choices from ONE option list on its `EnumField`,
 * in the one `SelectorOption` shape (`value`/`label`), and that list is the domain's own
 * (PLAN_FIELD_REGISTRY_DESCRIPTIONS_AND_SSOT.md §6).
 *
 * Also a SOURCE check on `OriginalShell.vue` / `OgNewProject.vue`: a `<select>` whose options
 * are written by hand in the template is a second copy of the list that the registry cannot
 * see drift.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {Engine} from '@openisd/design/engine';
import {VoiceCoilWiring} from '@openisd/design';
import {EnumField, NumberField} from '@openisd/design/fields';
import {LossMode} from '@openisd/design/engine';

const here = dirname(fileURLToPath(import.meta.url));
const shellSrc = readFileSync(join(here, '../../src/ui/shells/original/OriginalShell.vue'), 'utf8');
const wizardSrc = readFileSync(join(here, '../../src/ui/shells/original/OgNewProject.vue'), 'utf8');

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
    assert.deepEqual(optionsOf(EnumField.DRIVER_VCCON).map(o => o.value), [VoiceCoilWiring.Parallel, VoiceCoilWiring.Series]);
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
    assert.deepEqual(options, new Engine().sealedAlignmentOptions());
  });

  it('loss_DampingMode lists the engine loss modes, values being the tokens the project stores', () => {
    assert.deepEqual(optionsOf(EnumField.LOSS_DAMPINGMODE), LossMode.OPTIONS);
    assert.ok(optionsOf(EnumField.LOSS_DAMPINGMODE).some(o => o.value === 'winisd-lossy'));
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

describe('OriginalShell / OgNewProject — no dropdown writes its option list by hand', () => {
  it('every <select> reads its choice through selectedOption — no v-model, no Number(selectValue)', () => {
    for (const [name, src] of [['OriginalShell.vue', shellSrc], ['OgNewProject.vue', wizardSrc]] as const) {
      // A quoted attribute may hold `=>`, so quoted runs are consumed whole.
      const selects = src.match(/<select(?:"[^"]*"|[^">])*>/g) ?? [];
      assert.ok(selects.length > 0, `${name} renders no <select>`);
      for (const tag of selects) {
        assert.ok(!tag.includes('v-model'), `${name} binds a <select> with v-model, bypassing selectedOption: ${tag}`);
        assert.ok(tag.includes('selectedOption('), `${name} <select> does not read through selectedOption: ${tag}`);
      }
      assert.ok(!src.includes('Number(selectValue('), `${name} parses a select with Number(selectValue) instead of a typed option list`);
    }
    assert.ok(!shellSrc.includes('v-for="n in 8"'), 'the driver-count select hand-writes 1..8 instead of the registry range');
    assert.ok(!shellSrc.includes('<option>1</option>'), 'the vent-count select hand-writes its options and binds nothing');
  });

  it('vent shape, wiring and box type selects iterate an option list', () => {
    for (const literal of ['<option value="round">', '<option value="slotted">', '<option value="parallel">', '<option value="series">']) {
      assert.ok(!shellSrc.includes(literal), `OriginalShell.vue hand-writes ${literal}`);
    }
    assert.ok(!shellSrc.includes('o.id') && !wizardSrc.includes('o.id'),
      'a box-type select still reads the old {id,label} shape instead of SelectorOption {value,label}');
    assert.ok(!shellSrc.includes('option.qtc'), 'the sealed alignment select still reads .qtc instead of .value');
  });
});
