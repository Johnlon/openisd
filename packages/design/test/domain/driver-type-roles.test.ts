/**
 * `driver_type` is a non-empty list of roles, in enum declaration order, no duplicates (John
 * 2026-10-08, QT84/QT85). `categories` is an optional list of `{label, url}`.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {OpenISDDeviceJson} from '../../domain/openIsdDeviceJsonIo.js';
import {DriverRecordConverter} from '../../domain/driverRecordConverter.js';
import {createEngine} from '../../engine/Engine.js';
const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'corpus',
  'visaton-paw-25-8-ohm.roles.driver.json');

function fixtureWithRoles(roles: unknown): string {
  const record: unknown = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  if (typeof record !== 'object' || record === null) throw new Error('fixture shape');
  Object.assign(record, {driver_type: {value: roles, origin: 'manufacturer_product_page', definition: 'd'}});
  return JSON.stringify(record);
}

/** The openisd.json the bridge derives from the fixture: a record the schema fully accepts. */
function derivedOpenisdRecord(): Record<string, unknown> {
  const result = new DriverRecordConverter(createEngine()).driverYmlToOpenisdAndWdr(fixtureWithRoles(['woofer', 'midrange']));
  assert.ok(result.openisd !== null, JSON.stringify(result.errors));
  const parsed: unknown = JSON.parse(result.openisd);
  assert.ok(typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed));
  return Object.fromEntries(Object.entries(parsed));
}

function withRoles(roles: unknown): unknown {
  return {...derivedOpenisdRecord(), driver_type: {value: roles, origin: 'manufacturer_product_page'}};
}

describe('driver_type roles — schema', () => {
  it('accepts a two-role list, with categories', () => {
    const parsed = OpenISDDeviceJson.fromDriverYmlRecord(withRoles(['woofer', 'midrange']));
    assert.ok('json' in parsed, JSON.stringify(parsed));
    assert.deepEqual(parsed.json.driver_type.value, ['woofer', 'midrange']);
    assert.equal(parsed.json.categories?.value[0]?.label, 'Woofers');
  });

  it('refuses an empty list', () => {
    assert.ok('problems' in OpenISDDeviceJson.fromDriverYmlRecord(withRoles([])));
  });

  it('refuses a duplicate role', () => {
    assert.ok('problems' in OpenISDDeviceJson.fromDriverYmlRecord(withRoles(['woofer', 'woofer'])));
  });

  it('reads the old single-string form as a one-role list (the corpus still holds it; repair, never refuse)', () => {
    const parsed = OpenISDDeviceJson.fromDriverYmlRecord(withRoles('woofer'));
    assert.ok('json' in parsed, JSON.stringify(parsed));
    assert.deepEqual(parsed.json.driver_type.value, ['woofer']);
  });
});

describe('driver_type roles — the bridge', () => {
  it('converts a list-shaped driver.json and mirrors driver_type and categories into openisd.json', () => {
    const result = new DriverRecordConverter(createEngine()).driverYmlToOpenisdAndWdr(fixtureWithRoles(['woofer', 'midrange']));
    assert.deepEqual(result.errors.filter(e => e.level === 'error'), []);
    assert.equal(typeof result.wdr, 'string');
    assert.ok(result.openisd !== null);
    const out: unknown = JSON.parse(result.openisd);
    assert.ok(typeof out === 'object' && out !== null && 'driver_type' in out && 'categories' in out);
    const driverType = out.driver_type;
    assert.ok(typeof driverType === 'object' && driverType !== null && 'value' in driverType);
    assert.deepEqual(driverType.value, ['woofer', 'midrange']);
  });

  it('refuses an empty role list with an error entry and no wdr', () => {
    const result = new DriverRecordConverter(createEngine()).driverYmlToOpenisdAndWdr(fixtureWithRoles([]));
    assert.equal(result.wdr, null);
    assert.ok(result.errors.some(e => e.level === 'error'));
  });
});
