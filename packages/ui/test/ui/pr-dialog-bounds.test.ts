/**
 * The two passive-radiator dialogs enforce their entry bounds, and enforce them from ONE place.
 *
 * Both dialogs used to declare bounds twice: a `v-limits="{ min, max }"` on the raw input AND
 * the same field's `min`/`max` in fieldRegistry. Two declarations of one rule is the state this
 * suite exists to prevent — when the raw inputs became <NumInput field="…">, the `v-limits`
 * went with them, and any bound the registry did not already carry was silently lost. A lost
 * lower bound is invisible: the field simply starts accepting Fs = 0 Hz, and nothing on screen
 * says so.
 *
 * The rule pinned here: every numeric input in either dialog binds a registry `field`, and that
 * registry entry carries a finite min AND max. The registry is then the single enforcing
 * source (NumInput's `effMin`/`effMax` read it), so a bound can only be changed in the one
 * place that declares it.
 *
 * Oracle: fieldRegistry, and the bounds the dialogs themselves enforced before the migration —
 * quoted per field below in the units that dialog showed, converted through units.ts.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { fieldById } from '../../src/logic/fields/fieldRegistry.js';
import { fromDisplay } from '../../src/logic/fields/units.js';

const here = dirname(fileURLToPath(import.meta.url));
const components = join(here, '..', '..', 'src', 'ui', 'components');

/** Every `field="…"` bound on a NumInput in the given dialog. */
function boundFieldIds(file: string): string[] {
  const src = readFileSync(join(components, file), 'utf8');
  return [...src.matchAll(/<NumInput[^>]*?\bfield="([^"]+)"/g)].map((m) => m[1]);
}

describe('PR dialogs — every numeric entry is bounded by the registry', () => {
  for (const file of ['PRDefineModal.vue', 'PREditModal.vue']) {
    it(`${file}: every NumInput binds a registry field`, () => {
      const src = readFileSync(join(components, file), 'utf8');
      const inputs = [...src.matchAll(/<NumInput[\s\S]*?\/>/g)].map((m) => m[0]);
      assert.ok(inputs.length > 0, `${file} has no NumInput — has the dialog been restructured?`);
      for (const tag of inputs) {
        assert.match(
          tag,
          /\bfield="[^"]+"/,
          `${file} has a NumInput with no field="…" binding, so the registry's min/max never reach ` +
            `it and the entry is unbounded:\n  ${tag.replace(/\s+/g, ' ').slice(0, 160)}`,
        );
      }
    });

    it(`${file}: every field it binds declares a finite min and max`, () => {
      for (const id of boundFieldIds(file)) {
        const spec = fieldById(id);
        assert.ok(spec, `${file} binds field="${id}", which fieldRegistry does not declare`);
        assert.equal(typeof spec!.min, 'number', `${id} has no registry min — entry is unbounded below`);
        assert.equal(typeof spec!.max, 'number', `${id} has no registry max — entry is unbounded above`);
        assert.ok(Number.isFinite(spec!.min!) && Number.isFinite(spec!.max!), `${id}'s bounds are not finite`);
        assert.ok(spec!.min! < spec!.max!, `${id}'s min (${spec!.min}) is not below its max (${spec!.max})`);
      }
    });
  }
});

describe('PR entry bounds keep the limits the dialogs enforced before the registry owned them', () => {
  // Each case quotes the bound the dialog itself enforced, in the unit that dialog displayed,
  // and converts it with the same registry the inputs now use. No bound may be LOOSER than it
  // was: a widened floor silently admits values the form used to refuse.

  it('Sd: at least 1 cm², at most 100000 cm²', () => {
    const spec = fieldById('prSd')!;
    assert.equal(spec.max, fromDisplay(100000, 'area', 'cm2'), 'Sd ceiling moved off 100000 cm²');
    assert.ok(spec.min! >= fromDisplay(0.1, 'area', 'cm2'), 'Sd floor is looser than the 0.1 cm² the form enforced');
  });

  it('Xmax: 0 to 500 mm', () => {
    const spec = fieldById('prXmax')!;
    assert.equal(spec.max, fromDisplay(500, 'length', 'mm'), 'Xmax ceiling moved off 500 mm');
    assert.equal(spec.min, 0, 'Xmax floor moved off zero — an unexcursed PR is a legal entry');
  });

  it('Vas: at least 0.01 L, at most 100000 L', () => {
    const spec = fieldById('prVas')!;
    assert.equal(spec.max, fromDisplay(100000, 'volume', 'L'), 'Vas ceiling moved off 100000 L');
    assert.ok(spec.min! > 0, 'Vas floor is zero — a PR with no compliance volume is unphysical');
    assert.ok(spec.min! <= fromDisplay(0.01, 'volume', 'L'), 'Vas floor is tighter than the 0.01 L the form allowed');
  });

  it('Fs: at least 1 Hz, at most 1000 Hz', () => {
    const spec = fieldById('prFs')!;
    assert.equal(spec.max, 1000, 'Fs ceiling moved off 1000 Hz');
    assert.ok(spec.min! >= 1, 'Fs floor is below the 1 Hz the form enforced — 0 Hz is not a resonance');
  });

  it('Qms: at least 0.1, at most 100', () => {
    const spec = fieldById('prQms')!;
    assert.equal(spec.max, 100, 'Qms ceiling moved off 100');
    assert.ok(spec.min! >= 0.1, 'Qms floor is below the 0.1 the form enforced — a Q of 0 is unphysical');
  });

  it('PR count: 1 to 16 whole radiators', () => {
    const spec = fieldById('prNum')!;
    assert.equal(spec.min, 1, 'a design with a PR has at least one');
    assert.equal(spec.max, 16, 'PR count ceiling moved off 16');
  });
});
