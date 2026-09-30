import {describe, expect, it} from 'vitest';
import {MY_DRIVERS_KEY, createMemoryStorage, createMyDriverRepo} from '@openisd/persistence';
import {type Calculated, type Entered, type ProvenanceLetter, type Readable, OpenISDDriver} from '@openisd/design';
import {type DqIssue, createEngine} from '@openisd/design/engine';

const engine = createEngine();

/** The domain's own "zero or less is not physical" mark, narrowed — `positiveValueIssue` answers
 *  `null` for a value that passes, which a fixture value never does. */
function badValueMark(value: number): DqIssue {
  const issue = engine.issues.positiveValueIssue(value);
  if (issue === null) throw new Error(`${value} is a valid value, so there is no mark to read`);
  return issue;
}
import type {SpecField} from '../../src/logic/appState.js';
import {commitMyDriver, dqNoteFor, ebpVal} from '../../src/hooks/DriverEditorModal-hooks.js';

/** A field as the hook reads it: value, provenance and DQ, nothing else. */
function fakeCell(value: number | null, letter: ProvenanceLetter, dq: readonly DqIssue[] = []): Readable<number | null> & Entered & Calculated {
  return {
    name: '', value, provenance: letter, entered: letter === 'E', calculated: letter === 'C', dq,
    mandatoryAndUnsatisfied: dq.some(issue => issue.kind === 'missing-dependencies'),
  };
}

function cellMap(values: Partial<Record<SpecField, Readable<number | null> & Entered & Calculated>>) {
  return (field: SpecField): Readable<number | null> & Entered & Calculated =>
    values[field] ?? fakeCell(null, 'N');
}

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
  describe('dqNoteFor', () => {
    // BUG_20260927_driver-bad-value-decided-in-ui.md: a bad value (≤ 0, non-finite) is now the
    // DOMAIN's own mark on the field's `.dq` (`Engine.positiveValueIssue`,
    // driver-value-validity.test.ts) — `dqNoteFor` no longer judges the value itself, it only
    // renders whatever `.dq` the cell already carries, same as any other issue.
    it("renders the domain's own invalid-value mark for a zero-or-less field", () => {
      const cellOf = cellMap({Fs_hz: fakeCell(0, 'E', [badValueMark(0)])});
      expect(dqNoteFor(cellOf, 'Fs_hz')).toBe(badValueMark(0).text);
    });

    it("reads the cell's own dq() when the value is not bad, rendered to text", () => {
      const cellOf = cellMap({Fs_hz: fakeCell(40, 'C', [engine.issues.targetUnreachable('Fs_hz', 35)])});
      expect(dqNoteFor(cellOf, 'Fs_hz')).toBe('Fs_hz cannot reach this target - the maximum this geometry can reach is 35 Hz.');
    });

    it('is empty when the cell carries no dq marks', () => {
      const cellOf = cellMap({Fs_hz: fakeCell(40, 'E')});
      expect(dqNoteFor(cellOf, 'Fs_hz')).toBe('');
    });
  });

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
