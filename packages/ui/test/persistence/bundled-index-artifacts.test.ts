/**
 * The tracked catalogue artifacts — packages/ui/public/drivers-index.json,
 * passive-radiators-index.json and drivers/<path>.json — as `scripts/bundle-drivers.mjs` wrote
 * them. Two gates:
 *
 * IDENTITY. A device's identity is its record uuid (the list key, favourites, `load()`) and its
 * path locates its record file. If either repeats, the picker renders phantom rows (the `v-for`
 * key collides) or `load()` fetches the wrong record. Brand + model legitimately repeats — two
 * dated records of one driver share a name — so the name is never the identity.
 *
 * STALENESS. The rows are computed at bundle time by the app's own functions
 * (`bundledDriverIndexRowOf` / `bundledPassiveRadiatorIndexRowOf`). If those functions change
 * and the catalogue is not regenerated, the picker lists yesterday's rows. This recomputes the
 * rows for the browser suite's reference records from their tracked record files and holds
 * them against the tracked index — a drift fails here, naming the record, before it reaches a
 * spec.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { OpenISDDriver, OpenISDPassiveRadiatorStandalone } from '@openisd/design';
import { Engine } from '@openisd/design/engine';
import {
  readBundledDriverIndex, readBundledPassiveRadiatorIndex,
  type BundledDriverIndexRow, type BundledPassiveRadiatorIndexRow, type BundledIndexRow,
} from '@openisd/persistence';
import { bundledDriverIndexRowOf, bundledPassiveRadiatorIndexRowOf } from '../../src/logic/bundledIndexRows.js';
import testBundlePaths from '../fixtures/test-bundle-paths.json';

const PUBLIC = join(fileURLToPath(import.meta.url), '..', '..', '..', 'public');

function loadDriverIndex(): readonly BundledDriverIndexRow[] {
  const read = readBundledDriverIndex(JSON.parse(readFileSync(join(PUBLIC, 'drivers-index.json'), 'utf8')));
  if ('problems' in read) throw new Error(read.problems.join('\n'));
  return read.rows;
}

function loadRadiatorIndex(): readonly BundledPassiveRadiatorIndexRow[] {
  const read = readBundledPassiveRadiatorIndex(JSON.parse(readFileSync(join(PUBLIC, 'passive-radiators-index.json'), 'utf8')));
  if ('problems' in read) throw new Error(read.problems.join('\n'));
  return read.rows;
}

function recordOf(path: string): unknown {
  return JSON.parse(readFileSync(join(PUBLIC, 'drivers', `${path}.json`), 'utf8'));
}

function assertUnique(rows: readonly BundledIndexRow[], which: string): void {
  const byUuid = new Map<string, string>();
  const byPath = new Map<string, string>();
  for (const r of rows) {
    assert.ok(r.uuid.length > 0 && r.path.length > 0, `${which}: a row is missing its uuid or path (name=${r.name})`);
    assert.equal(byUuid.get(r.uuid), undefined, `${which}: uuid "${r.uuid}" of "${r.path}" collides with "${byUuid.get(r.uuid)}"`);
    assert.equal(byPath.get(r.path), undefined, `${which}: path "${r.path}" collides`);
    byUuid.set(r.uuid, r.path);
    byPath.set(r.path, r.uuid);
  }
}

describe('the tracked catalogue — identity', () => {
  it('every driver and radiator uuid and path is unique across both indexes', () => {
    const drivers = loadDriverIndex();
    const radiators = loadRadiatorIndex();
    assertUnique(drivers, 'drivers-index.json');
    assertUnique(radiators, 'passive-radiators-index.json');
    assertUnique([...drivers, ...radiators], 'both indexes');
    assert.ok(drivers.length > 1000, `only ${drivers.length} drivers — the catalogue is not the corpus`);
  });
});

describe('the tracked catalogue — staleness', () => {
  const engine = new Engine();

  it('the index rows for the reference records equal the rows recomputed from their record files', () => {
    const drivers = loadDriverIndex();
    const radiators = loadRadiatorIndex();
    for (const path of testBundlePaths) {
      const driverRow = drivers.find(r => r.path === path);
      const radiatorRow = radiators.find(r => r.path === path);
      assert.ok(driverRow !== undefined || radiatorRow !== undefined, `${path}: in neither index`);
      const record = recordOf(path);
      if (driverRow !== undefined) {
        const driver = OpenISDDriver.fromConformingRecord(record, engine);
        assert.ok(!Array.isArray(driver), `${path}: ${Array.isArray(driver) ? driver.join('; ') : ''}`);
        assert.deepEqual(driverRow, bundledDriverIndexRowOf(driver, path), `${path}: drivers-index.json is stale — run scripts/bundle-drivers.mjs`);
      } else if (radiatorRow !== undefined) {
        const radiator = OpenISDPassiveRadiatorStandalone.fromConformingRecord(record, engine);
        assert.ok(!Array.isArray(radiator), `${path}: ${Array.isArray(radiator) ? radiator.join('; ') : ''}`);
        assert.deepEqual(radiatorRow, bundledPassiveRadiatorIndexRowOf(radiator, path), `${path}: passive-radiators-index.json is stale — run scripts/bundle-drivers.mjs`);
      }
    }
  });
});
