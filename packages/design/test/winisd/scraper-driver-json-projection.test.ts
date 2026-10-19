import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {parse} from 'yaml';
import {WinIsdDriverConverter} from '../../domain/winIsdDriverConverter.js';
import {openISDDeviceJsonSchema} from '../../domain/openisdSchema.js';
import {createEngine} from '../../engine/Engine.js';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'scraper-driver-json');

const engine = createEngine();

/** Today's scraper record: no quality.missing, no quality.cross_source_only, driver_type.value an
 *  array, and a `printed` list. Copied from the read-only db (morel/tiw-634nd). */
const NEW_RECORD = readFileSync(join(FIXTURES, 'morel-tiw-634nd.driver.json'), 'utf8');
/** An older record: quality.missing and quality.cross_source_only present, driver_type.value a bare string. */
const OLD_RECORD = readFileSync(join(FIXTURES, 'bc-10bg76-8.driver.json'), 'utf8');

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function at(v: unknown, key: string): unknown {
  if (!isRecord(v)) throw new Error(`expected an object holding ${key}`);
  return v[key];
}

function project(text: string) {
  return new WinIsdDriverConverter(engine).driverYmlToOpenisdAndWdr(text);
}

function keysOf(text: string | null): string[] {
  assert.ok(text !== null, 'a projection was produced');
  const parsed: unknown = parse(text);
  assert.ok(typeof parsed === 'object' && parsed !== null, 'a record');
  return Object.keys(parsed);
}

describe('driver.json the scraper writes today', () => {
  it('today\'s record (no quality.missing, array driver_type, printed) projects without errors', () => {
    const result = project(NEW_RECORD);
    assert.deepEqual(result.errors.filter(e => e.level === 'error'), []);
    assert.ok(result.openisd !== null && result.wdr !== null);
  });

  it('an older record (quality.missing present, string driver_type) still projects without errors', () => {
    const result = project(OLD_RECORD);
    assert.deepEqual(result.errors.filter(e => e.level === 'error'), []);
    assert.ok(result.openisd !== null && result.wdr !== null);
  });

  it('openisd.json carries no printed key', () => {
    assert.ok(NEW_RECORD.includes('"printed"'), 'the fixture must carry printed, or this proves nothing');
    assert.ok(!keysOf(project(NEW_RECORD).openisd).includes('printed'));
  });

  it('the .wdr carries no printed text', () => {
    assert.ok(project(NEW_RECORD).wdr?.toLowerCase().includes('printed') === false);
  });

  it('an absent quality.missing stays absent: no default is invented', () => {
    const quality = at(parse(project(NEW_RECORD).openisd ?? 'null'), 'quality');
    assert.ok(isRecord(quality));
    assert.ok(!('missing' in quality), 'quality.missing stays absent');
    assert.ok(!('cross_source_only' in quality), 'quality.cross_source_only stays absent');
  });

  it('a string driver_type and a one-element array parse to the same list', () => {
    const rolesOf = (value: unknown): readonly string[] => {
      const record: unknown = parse(OLD_RECORD);
      const type = at(record, 'driver_type');
      if (!isRecord(type)) throw new Error('expected driver_type');
      type.value = value;
      const openisd = project(JSON.stringify(record)).openisd;
      return openISDDeviceJsonSchema.parse(parse(openisd ?? 'null')).driver_type.value;
    };
    assert.deepEqual(rolesOf('subwoofer'), ['subwoofer']);
    assert.deepEqual(rolesOf(['subwoofer']), ['subwoofer']);
  });
});
