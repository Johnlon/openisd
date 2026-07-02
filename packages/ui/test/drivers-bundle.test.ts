/**
 * Driver-identity invariants for the sources.json map (v2) and the generated
 * bundle.
 *
 * A driver's unique identity is its source KEY + its PATH within that source —
 * never its display name (Brand + Model legitimately repeats: two dated files of
 * the same driver share one name). If these invariants break, the driver browser
 * renders phantom/duplicated rows because the v-for :key collides. See
 * .claude/context/ui-rules.md "Unique list-key rule" and drivers/sources.schema.md.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

interface SourcesJson {
  version: number;
  sources: Record<string, { name?: string; url?: string }>;
}
interface BundleJson {
  sources: Array<{ key: string; files: Array<{ name?: string; path?: string }> }>;
}

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const sources = JSON.parse(readFileSync(join(ROOT, 'drivers/sources.json'), 'utf8')) as SourcesJson;
const bundle = JSON.parse(readFileSync(join(ROOT, 'packages/ui/src/drivers-bundle.json'), 'utf8')) as BundleJson;

describe('sources.json (v2 keyed map)', () => {
  it('keys sources as a map, not an array', () => {
    assert.equal(Array.isArray(sources.sources), false, 'sources must be a keyed object (map), not an array');
    assert.equal(typeof sources.sources, 'object');
    assert.ok(sources.version >= 2, `version must be >= 2 for the map schema (got ${sources.version})`);
  });

  it('every source has a non-empty key, name, and url', () => {
    for (const [key, src] of Object.entries(sources.sources)) {
      assert.ok(key && typeof key === 'string', `source key must be a non-empty string (got ${JSON.stringify(key)})`);
      assert.ok(src.name, `source "${key}" must have a name`);
      assert.ok(src.url, `source "${key}" must have a url`);
    }
  });
});

describe('drivers-bundle.json — driver identity = sourceKey + path', () => {
  it('every bundled source carries a unique key', () => {
    const keys = bundle.sources.map(s => s.key);
    for (const k of keys) {
      assert.ok(k && typeof k === 'string', `bundled source key must be a non-empty string (got ${JSON.stringify(k)})`);
    }
    assert.equal(new Set(keys).size, keys.length, `bundled source keys must be unique; got [${keys.join(', ')}]`);
  });

  it('every file carries a non-empty path within its source', () => {
    for (const src of bundle.sources) {
      for (const f of src.files) {
        assert.ok(
          f.path && typeof f.path === 'string',
          `file in source "${src.key}" is missing its path (name=${f.name}) — the bundler must emit a per-file path`,
        );
      }
    }
  });

  it('every (sourceKey, path) driver identity is globally unique', () => {
    const seen = new Map();
    for (const src of bundle.sources) {
      for (const f of src.files) {
        const id = src.key + '/' + f.path;
        const prev = seen.get(id);
        assert.equal(
          prev,
          undefined,
          `duplicate driver identity "${id}" — a second file collides with "${prev}". ` +
          'The browser v-for :key would collide and render phantom/duplicated rows.',
        );
        seen.set(id, f.name);
      }
    }
  });
});
