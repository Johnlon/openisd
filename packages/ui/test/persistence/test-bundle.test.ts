/**
 * The browser suite runs against a small catalogue — the reference devices named in
 * `fixtures/test-bundle-paths.json` — not the whole 2000-record one. Every `page.goto('/')`
 * boots the app, and the pickers fetch the indexes; the specs name or count only a handful of
 * bundled rows.
 *
 * `selectCatalogue` (scripts/testBundle.mjs) cuts that catalogue out of the tracked production
 * indexes by record path, with no corpus access — CI has no `winisd_drivers` checkout. A path in
 * neither index is an error, not a silent omission: a spec that filters the picker for
 * `W5-1138SMF` must fail because the app is wrong, never because the fixture list drifted.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {selectCatalogue} from '../../../../scripts/testBundle.mjs';
import {readBundledDriverIndex, readBundledPassiveRadiatorIndex} from '@openisd/persistence';
import testBundlePaths from '../fixtures/test-bundle-paths.json';

const PUBLIC = join(fileURLToPath(import.meta.url), '..', '..', '..', 'public');

interface PathRow { readonly path: string }
const row = (path: string): PathRow => ({ path });

const drivers = [row('a/one'), row('a/two'), row('a/three')];
const radiators = [row('a/pr'), row('a/pr2')];

describe('selectCatalogue — the browser suite catalogue is cut from the tracked indexes by path', () => {
  it('keeps exactly the listed rows, each in the index it came from, verbatim', () => {
    const out = selectCatalogue(drivers, radiators, ['a/two', 'a/pr2']);
    assert.deepEqual(out.driverRows, [drivers[1]]);
    assert.equal(out.driverRows[0], drivers[1]);
    assert.deepEqual(out.radiatorRows, [radiators[1]]);
  });

  it('refuses a path neither index carries, naming it', () => {
    assert.throws(() => selectCatalogue(drivers, radiators, ['a/one', 'nowhere']),
      (e: Error) => e.message.includes('nowhere'));
  });

  it('refuses an empty selection — a suite that runs against no drivers proves nothing', () => {
    assert.throws(() => selectCatalogue(drivers, radiators, []));
  });
});

describe('fixtures/test-bundle-paths.json — every named reference device is in the tracked catalogue', () => {
  it('selects every listed path, with its record file present', () => {
    const driverIndex = readBundledDriverIndex(JSON.parse(readFileSync(join(PUBLIC, 'drivers-index.json'), 'utf8')));
    const radiatorIndex = readBundledPassiveRadiatorIndex(JSON.parse(readFileSync(join(PUBLIC, 'passive-radiators-index.json'), 'utf8')));
    assert.ok('rows' in driverIndex, 'problems' in driverIndex ? driverIndex.problems.join('\n') : '');
    assert.ok('rows' in radiatorIndex, 'problems' in radiatorIndex ? radiatorIndex.problems.join('\n') : '');

    const out = selectCatalogue(driverIndex.rows, radiatorIndex.rows, testBundlePaths);
    assert.equal(out.driverRows.length + out.radiatorRows.length, testBundlePaths.length);
    for (const r of [...out.driverRows, ...out.radiatorRows]) {
      assert.ok(existsSync(join(PUBLIC, 'drivers', `${r.path}.json`)), `${r.path} has no record file`);
    }
    // The suite filters the picker for this model and picks it — it must be a driver row.
    assert.ok(out.driverRows.some(r => r.path === 'tang-band/w5-1138smf'));
    // Diversity the specs rely on: a coaxial, and two passive radiators.
    assert.ok(out.driverRows.some(r => r.canonical === 'Coaxial'), 'no coaxial');
    assert.equal(out.radiatorRows.length, 2);
  });
});
