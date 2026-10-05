/**
 * The passive-radiator page enforces its entry bounds, and enforces them from ONE place.
 *
 * The PR entry used to declare bounds twice: a `v-limits="{ min, max }"` on the raw input AND the
 * same field's `min`/`max` in uiFields. When the raw inputs became <NumInput field="…">, the
 * `v-limits` went with them, and any bound the registry did not already carry was silently lost.
 *
 * The rule pinned here (a SOURCE check of each skin's passive-radiator pane): every numeric input
 * on the pane binds a registry `field`, and that registry entry carries a finite min AND max. The registry
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
const shells = join(here, '..', '..', 'src', 'ui', 'shells');

/** The passive-radiator pane of a shell template: from its `v-else-if` to the next one. */
function prPane(file: string): string {
  const src = readFileSync(join(shells, file), 'utf8');
  const start = src.indexOf("v-else-if=\"selectedBox === 'box-passive-radiator'\"");
  assert.ok(start >= 0, `${file} has no passive-radiator pane`);
  const end = src.indexOf('v-else-if=', start + 1);
  return src.slice(start, end < 0 ? undefined : end);
}

/** Every registry member bound as `:field` on a NumInput in the given pane. */
function boundFields(file: string): Field[] {
  const src = prPane(file);
  const members = new Map(Object.entries(NumberField).filter((e): e is [string, Field] => e[1] instanceof Field));
  const tags = [...src.matchAll(/<NumInput[\s\S]*?\/>/g)].map((m) => m[0]);
  return tags.flatMap((tag) => [...tag.matchAll(/:field="NumberField\.([A-Z0-9_]+)"/g)]).map((m) => {
    const f = members.get(m[1]);
    assert.ok(f, `${file} binds NumberField.${m[1]}, which is not a registry member`);
    return f!;
  });
}

describe('PR page — every numeric entry is bounded by the registry', () => {
  for (const file of ['original/OriginalShell.vue', 'mobile/MobileEnclosureTab.vue']) {
    it(`${file}: every NumInput binds a registry field`, () => {
      const src = prPane(file);
      const inputs = [...src.matchAll(/<NumInput[\s\S]*?\/>/g)].map((m) => m[0]);
      assert.ok(inputs.length > 0, `${file} has no NumInput on its PR pane — has the pane been restructured?`);
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
