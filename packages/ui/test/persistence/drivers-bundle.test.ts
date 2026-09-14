/**
 * Driver-identity invariants for the generated bundle.
 *
 * A driver's unique identity is its source KEY + its PATH within that source —
 * never its display name (Brand + Model legitimately repeats: two dated files of
 * the same driver share one name). If these invariants break, the driver browser
 * renders phantom/duplicated rows because the v-for :key collides. See
 * .claude/rules/openisd-ui-design.md "Unique list-key rule".
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import bundleJson from '../../src/drivers-bundle.json';
interface BundleJson {
  files: Array<{ name?: string; path?: string }>;
}

const bundle = bundleJson as BundleJson;

describe('drivers-bundle.json — driver identity = sourceKey + path', () => {
  it('every file carries a non-empty path within the bundled corpus', () => {
    for (const f of bundle.files) {
      assert.ok(f.path && typeof f.path === 'string', `bundled file is missing its path (name=${f.name})`);
    }
  });

  it('every bundled driver path is globally unique', () => {
    const seen = new Map();
    for (const f of bundle.files) {
      const prev = seen.get(f.path);
      assert.equal(prev, undefined, `duplicate driver path "${f.path}" collides with "${prev}"`);
      seen.set(f.path, f.name);
    }
  });
});
