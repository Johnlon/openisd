/**
 * The passive-radiator dialog enforces its entry bounds, and enforces them from ONE place.
 *
 * The dialog used to declare bounds twice: a `v-limits="{ min, max }"` on the raw input AND the
 * same field's `min`/`max` in uiFields. When the raw inputs became <NumInput field="…">, the
 * `v-limits` went with them, and any bound the registry did not already carry was silently lost.
 *
 * The rule pinned here (a SOURCE check of PREditModal.vue): every numeric input in the dialog
 * binds a registry `field`, and that registry entry carries a finite min AND max. The registry
 * is then the single enforcing source (NumInput's `effMin`/`effMax` read it). The bounds
 * themselves are pinned in design/test/fields/pr-entry-limits.test.ts.
 */

import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {Field, NumberField} from '@openisd/design/fields';

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
