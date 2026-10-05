import {describe, expect, it} from 'vitest';
import {MY_DRIVERS_KEY, createMemoryStorage, createMyDriverRepo} from '@openisd/persistence';
import {OpenISDDriver} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {commitMyDriver, ebpVal} from '../../src/hooks/DriverEditorModal-hooks.js';

function completeDriver(): OpenISDDriver {
  const engine = createEngine();
  const driver = OpenISDDriver.empty(engine);
  driver.specs.Fs_hz.set(40);
  driver.specs.Qes.set(0.45);
  driver.specs.Qms.set(4);
  driver.specs.Vas_m3.set(0.03);
  driver.specs.Re_ohm.set(6);
  driver.specs.Sd_m2.set(0.02);
  return driver;
}

describe('DriverEditorModal-hooks', () => {
  describe('ebpVal', () => {
    it('reads the driver EBP once Fs and Qes are both known', () => {
      const driver = completeDriver();
      expect(ebpVal(driver)).toBeCloseTo(40 / 0.45, 1);
    });

    it('is null before the driver can derive it', () => {
      const driver = OpenISDDriver.empty(createEngine());
      expect(ebpVal(driver)).toBeNull();
    });
  });

  describe('commitMyDriver', () => {
    function savedWith(model: string) {
      const myDrivers = createMyDriverRepo(createMemoryStorage(), createEngine());
      const driver = completeDriver();
      driver.brand.set('Test');
      driver.model.set(model);
      const saved = myDrivers.upsert(driver);
      if (saved === null) throw new Error('memory storage refused a save');
      return {myDrivers, driver, uuid: saved.uuid};
    }

    it('overwrites the opened row, so an edit never appends a twin', () => {
      const {myDrivers, driver, uuid} = savedWith('Fixture');
      driver.model.set('Fixture Mk2');
      expect(commitMyDriver(myDrivers, driver, uuid)).toBe(true);
      expect(myDrivers.list().map(e => [e.uuid, e.driver.model.value])).toEqual([[uuid, 'Fixture Mk2']]);
    });

    it('files a new row when nothing was opened', () => {
      const {myDrivers, driver} = savedWith('Fixture');
      expect(commitMyDriver(myDrivers, driver.copyAsNew(), '')).toBe(true);
      expect(myDrivers.list()).toHaveLength(2);
    });

    it('answers false while My Drivers is unreadable (read-only)', () => {
      const storage = createMemoryStorage();
      const myDrivers = createMyDriverRepo(storage, createEngine());
      storage.set(MY_DRIVERS_KEY, 'not json');
      expect(commitMyDriver(myDrivers, completeDriver(), '')).toBe(false);
    });
  });
});
