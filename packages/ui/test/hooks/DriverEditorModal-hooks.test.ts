import {describe, expect, it} from 'vitest';
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
import {dqNoteFor, ebpVal} from '../../src/hooks/DriverEditorModal-hooks.js';

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
});
