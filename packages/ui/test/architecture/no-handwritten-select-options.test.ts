/**
 * A `<select>` whose options are written by hand in the OriginalShell / OriginalNewProject
 * templates is a second copy of the registry's option list that the registry cannot see drift.
 * This is a SOURCE check: every dropdown reads its choice through `selectedOption` over an
 * `EnumField` option list (see design/test/fields/field-registry.test.ts).
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const shellSrc = readFileSync(join(here, '../../src/ui/shells/original/OriginalShell.vue'), 'utf8');
const wizardSrc = readFileSync(join(here, '../../src/ui/shells/original/OriginalNewProject.vue'), 'utf8');

describe('OriginalShell / OriginalNewProject — no dropdown writes its option list by hand', () => {
  it('every <select> reads its choice through selectedOption — no v-model, no Number(selectValue)', () => {
    for (const [name, src] of [['OriginalShell.vue', shellSrc], ['OriginalNewProject.vue', wizardSrc]] as const) {
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
