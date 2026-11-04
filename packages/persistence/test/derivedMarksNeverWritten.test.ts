/**
 * QO414 (John, 4 Nov 2026): "dont write DQ stuff anywhere - its all meant to be dynamic"; "if there
 * are any warnings in my driver then they should be silently dropped". Data-quality marks
 * (`dq_calculated`, `dq_scraper`) are worked out live and shown on screen only: My Drivers and
 * exported driver files never hold them, and a saved record that carries them still loads.
 */
import {readFileSync} from 'node:fs';
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {OpenISDDriver} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {MY_DRIVERS_KEY} from '../src/repos/myDriverRepo.js';
import {createMemoryStorage} from '../src/storage/keyValueStorage.js';
import {myDriverRepoOn} from './fixtures/repoOn.js';

const engine = createEngine();
const BC_18NW100_4 = new URL('../../ui/public/drivers/b-c-speakers/18nw100-4.json', import.meta.url);
const bcRecord: unknown = JSON.parse(readFileSync(BC_18NW100_4, 'utf8'));
const noMarks = (text: string) => assert.ok(!/dq_calculated|dq_scraper/.test(text), 'a data-quality mark was written');

function bcDriver() {
  const driver = OpenISDDriver.fromConformingRecord(bcRecord, engine);
  if (Array.isArray(driver)) throw new Error(driver.join('; '));
  return driver;
}

describe('data-quality marks are never written', () => {
  it('the fixture carries marks, so the checks below mean something', () => {
    assert.match(readFileSync(BC_18NW100_4, 'utf8'), /dq_calculated/);
  });

  it('a driver with a known disagreement saved to My Drivers is stored without marks, and still shows its warning after load', () => {
    const storage = createMemoryStorage();
    myDriverRepoOn(storage, engine).upsert(bcDriver());
    noMarks(storage.get(MY_DRIVERS_KEY) ?? '');

    const back = myDriverRepoOn(storage, engine).list();
    assert.equal(back.length, 1);
    assert.ok(back[0].driver.inconsistentInputReasons().length > 0, 'the warning is worked out live');
  });

  it('an exported driver file holds no marks', () => {
    noMarks(bcDriver().toOwdrText());
    noMarks(JSON.stringify(bcDriver().toOpenIsdDeviceJson()));
  });

  it('a saved record that carries marks loads silently, with them dropped', () => {
    const storage = createMemoryStorage();
    storage.set(MY_DRIVERS_KEY, JSON.stringify({entries: [{uuid: 'aaaaaaaa-0000-4000-8000-000000000001', record: bcRecord}]}));
    const back = myDriverRepoOn(storage, engine).list();
    assert.equal(back.length, 1);
    noMarks(JSON.stringify(back[0].driver.toOpenIsdDeviceJson()));
  });

  it('a scraper mark on an entered value is dropped on read too', () => {
    const mark = '{"kind":"range","severity":"error","rule":"r","detail":"d","params":{}}';
    const withScraperMark = readFileSync(BC_18NW100_4, 'utf8').replace('"Qts":{', `"Qts":{"dq_scraper":[${mark}],`);
    assert.match(withScraperMark, /dq_scraper/);
    const record: unknown = JSON.parse(withScraperMark);
    const driver = OpenISDDriver.fromConformingRecord(record, engine);
    if (Array.isArray(driver)) throw new Error(driver.join('; '));
    noMarks(driver.toOwdrText());
  });
});
