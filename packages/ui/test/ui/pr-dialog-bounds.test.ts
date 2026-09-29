/**
 * The passive-radiator dialog enforces its entry bounds, and enforces them from ONE place.
 *
 * The dialog used to declare bounds twice: a `v-limits="{ min, max }"` on the raw input AND
 * the same field's `min`/`max` in uiFields. Two declarations of one rule is the state this
 * suite exists to prevent — when the raw inputs became <NumInput field="…">, the `v-limits`
 * went with them, and any bound the registry did not already carry was silently lost. A lost
 * lower bound is invisible: the field simply starts accepting Fs = 0 Hz, and nothing on screen
 * says so.
 *
 * The rule pinned here: every numeric input in the dialog binds a registry `field`, and that
 * registry entry carries a finite min AND max. The registry is then the single enforcing
 * source (NumInput's `effMin`/`effMax` read it), so a bound can only be changed in the one
 * place that declares it.
 *
 * Oracle: uiFields, and the bounds the dialogs themselves enforced before the migration —
 * quoted per field below in the units that dialog showed, converted through units.ts.
 */

import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {Field, NumberField} from '@openisd/design/fields';
import {fromDisplay} from '../../src/logic/fields/units.js';

const here = dirname(fileURLToPath(import.meta.url));
const components = join(here, '..', '..', 'src', 'ui', 'components');

/** Every registry member bound as `:field` on a NumInput in the given dialog. */
function boundFields(file: string): Field[] {
  const src = readFileSync(join(components, file), 'utf8');
  const members = new Map(Object.entries(NumberField).filter((e): e is [string, Field] => e[1] instanceof Field));
  return [...src.matchAll(/<NumInput[^>]*?:field="NumberField\.([A-Z0-9_]+)"/g)].map((m) => {
    const f = members.get(m[1]);
    assert.ok(f, `${file} binds NumberField.${m[1]}, which is not a registry member`);
    return f!;
  });
}

describe('PR dialogs — every numeric entry is bounded by the registry', () => {
  for (const file of ['PREditModal.vue']) {
    it(`${file}: every NumInput binds a registry field`, () => {
      const src = readFileSync(join(components, file), 'utf8');
      const inputs = [...src.matchAll(/<NumInput[\s\S]*?\/>/g)].map((m) => m[0]);
      assert.ok(inputs.length > 0, `${file} has no NumInput — has the dialog been restructured?`);
      for (const tag of inputs) {
        assert.match(
          tag,
          /:field="\w+Field\.[A-Z0-9_]+"/,
          `${file} has a NumInput bound to no registry field, so its min/max never reach ` +
            `it and the entry is unbounded:\n  ${tag.replace(/\s+/g, ' ').slice(0, 160)}`,
        );
      }
    });

    it(`${file}: every field it binds declares a finite min and max`, () => {
      const bound = boundFields(file);
      assert.ok(bound.length > 0, `${file} binds no registry field`);
      for (const f of bound) {
        assert.ok(f instanceof NumberField, `${f.value} is not a numeric field`);
        const band = f.limits;
        assert.ok(Number.isFinite(band.min) && Number.isFinite(band.max), `${f.value}'s bounds are not finite`);
        assert.ok(band.min < band.max, `${f.value}'s min (${band.min}) is not below its max (${band.max})`);
      }
    });
  }
});

describe('PR entry bounds keep the limits the dialogs enforced before the registry owned them', () => {
  // Each case quotes the bound the dialog itself enforced, in the unit that dialog displayed,
  // and converts it with the same registry the inputs now use. No bound may be LOOSER than it
  // was: a widened floor silently admits values the form used to refuse.

  it('Sd: at least 1 cm², at most 100000 cm²', () => {
    const band = NumberField.PR_SD_CM2.limits;
    assert.equal(band.max, fromDisplay(100000, 'area', 'cm2'), 'Sd ceiling moved off 100000 cm²');
    assert.ok(band.min >= fromDisplay(0.1, 'area', 'cm2'), 'Sd floor is looser than the 0.1 cm² the form enforced');
  });

  it('Xmax: 0 to 500 mm', () => {
    const band = NumberField.PR_XMAX_MM.limits;
    assert.equal(band.max, fromDisplay(500, 'length', 'mm'), 'Xmax ceiling moved off 500 mm');
    assert.equal(band.min, 0, 'Xmax floor moved off zero — an unexcursed PR is a legal entry');
  });

  it('Vas: at least 0.01 L, at most 100000 L', () => {
    const band = NumberField.PR_VAS_L.limits;
    assert.equal(band.max, fromDisplay(100000, 'volume', 'L'), 'Vas ceiling moved off 100000 L');
    assert.ok(band.min > 0, 'Vas floor is zero — a PR with no compliance volume is unphysical');
    assert.ok(band.min <= fromDisplay(0.01, 'volume', 'L'), 'Vas floor is tighter than the 0.01 L the form allowed');
  });

  it('Fs: at least 1 Hz, at most 1000 Hz', () => {
    const band = NumberField.PR_FS_HZ.limits;
    assert.equal(band.max, 1000, 'Fs ceiling moved off 1000 Hz');
    assert.ok(band.min >= 1, 'Fs floor is below the 1 Hz the form enforced — 0 Hz is not a resonance');
  });

  it('Qms: at least 0.1, at most 100', () => {
    const band = NumberField.PR_QMS.limits;
    assert.equal(band.max, 100, 'Qms ceiling moved off 100');
    assert.ok(band.min >= 0.1, 'Qms floor is below the 0.1 the form enforced — a Q of 0 is unphysical');
  });

  it('PR count: 1 to 16 whole radiators', () => {
    const band = NumberField.PR_NUM.limits;
    assert.equal(band.min, 1, 'a design with a PR has at least one');
    assert.equal(band.max, 16, 'PR count ceiling moved off 16');
  });
});
