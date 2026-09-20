/**
 * `uiFields.ts` — every dropdown the shell renders lists its choices from ONE option list on
 * its field spec, in the one `SelectorOption` shape (`value`/`label`), and that list is the
 * domain's own (PLAN_FIELD_REGISTRY_DESCRIPTIONS_AND_SSOT.md §6).
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
import {fieldById} from '../../src/logic/fields/uiFields.js';
import {lossModeOptions} from '../../src/logic/environment.js';

const here = dirname(fileURLToPath(import.meta.url));
const shellSrc = readFileSync(join(here, '../../src/ui/shells/original/OriginalShell.vue'), 'utf8');
const wizardSrc = readFileSync(join(here, '../../src/ui/shells/original/OgNewProject.vue'), 'utf8');

function optionsOf(id: string) {
  const spec = fieldById(id);
  assert.ok(spec, `uiFields has no "${id}"`);
  assert.equal(spec.kind, 'enum', `${id} is not an enum field`);
  assert.ok(spec.options && spec.options.length > 0, `${id} carries no options`);
  for (const o of spec.options) {
    assert.deepEqual(Object.keys(o).sort(), ['label', 'value'], `${id} option is not a SelectorOption: ${JSON.stringify(o)}`);
  }
  return spec.options;
}

describe('uiFields — every dropdown is an enum spec carrying SelectorOption[]', () => {
  it('vent_Shape lists round and slotted', () => {
    assert.deepEqual(optionsOf('vent_Shape').map(o => o.value), ['round', 'slotted']);
  });

  it('driver_VCCon values ARE the domain wiring values, so a chosen option can be written straight to the driver', () => {
    assert.deepEqual(optionsOf('driver_VCCon').map(o => o.value), [VoiceCoilWiring.Parallel, VoiceCoilWiring.Series]);
  });

  it('driver_ArrayWiring lists parallel and series', () => {
    assert.deepEqual(optionsOf('driver_ArrayWiring').map(o => o.value), ['parallel', 'series']);
  });

  it('box_Type lists every enclosure type the Box tab offers, simulatable or not', () => {
    assert.deepEqual(optionsOf('box_Type').map(o => o.value),
      ['sealed', 'vented', 'box-passive-radiator', 'bandpass4', 'bandpass6', 'abc']);
  });

  it('box_Qtc lists the nine WinISD sealed alignments and is the SAME list the engine hands out', () => {
    const options = optionsOf('box_Qtc');
    assert.equal(options.length, 9);
    assert.deepEqual(options, new Engine().sealedAlignmentOptions());
  });

  it('loss_DampingMode lists the engine loss modes, values being the tokens the project stores', () => {
    assert.deepEqual(optionsOf('loss_DampingMode'), lossModeOptions());
    assert.ok(optionsOf('loss_DampingMode').some(o => o.value === 'winisd-lossy'));
  });

  it('filter_Type lists the six filter types the engine models', () => {
    assert.deepEqual(optionsOf('filter_Type').map(o => o.value),
      ['lowpass', 'highpass', 'linkwitz', 'peaking', 'lowshelf', 'highshelf']);
  });
});

describe('OriginalShell / OgNewProject — no dropdown writes its option list by hand', () => {
  it('vent shape, wiring and box type selects iterate an option list', () => {
    for (const literal of ['<option value="round">', '<option value="slotted">', '<option value="parallel">', '<option value="series">']) {
      assert.ok(!shellSrc.includes(literal), `OriginalShell.vue hand-writes ${literal}`);
    }
    assert.ok(!shellSrc.includes('o.id') && !wizardSrc.includes('o.id'),
      'a box-type select still reads the old {id,label} shape instead of SelectorOption {value,label}');
    assert.ok(!shellSrc.includes('option.qtc'), 'the sealed alignment select still reads .qtc instead of .value');
  });
});
