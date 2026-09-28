import {describe, expect, it} from 'vitest';
import {type Calculated, type Entered, type Readable, OpenISDDriver} from '@openisd/design';
import type {ProvenanceLetter} from '../../src/logic/fieldProvenance.js';
import {type DqIssue, Engine} from '@openisd/design/engine';

const engine = new Engine();

/** The domain's own "zero or less is not physical" mark, narrowed — `positiveValueIssue` answers
 *  `null` for a value that passes, which a fixture value never does. */
function badValueMark(value: number): DqIssue {
  const issue = engine.positiveValueIssue(value);
  if (issue === null) throw new Error(`${value} is a valid value, so there is no mark to read`);
  return issue;
}
import type {SpecField} from '../../src/logic/appState.js';
import {
  chartBlockingReasonsFor,
  dqNoteFor,
  driverIssues,
  ebpVal,
  inconsistentInputReasonsFor,
} from '../../src/hooks/DriverEditorModal-hooks.js';

/** A field as the hook reads it: value, provenance and DQ, nothing else. */
function fakeCell(value: number | null, letter: ProvenanceLetter, dq: readonly DqIssue[] = []): Readable<number | null> & Entered & Calculated {
  return {
    name: '', value, entered: letter === 'E', calculated: letter === 'C', dq,
    mandatoryAndUnsatisfied: dq.some(issue => issue.kind === 'missing-dependencies'),
  };
}

function cellMap(values: Partial<Record<SpecField, Readable<number | null> & Entered & Calculated>>) {
  return (field: SpecField): Readable<number | null> & Entered & Calculated =>
    values[field] ?? fakeCell(null, 'N');
}

/** Every mandatory field stated, so nothing but an issue can put a line in either list. */
function allMandatorySet() {
  return cellMap({
    Fs_hz: fakeCell(40, 'E'),
    Vas_m3: fakeCell(0.03, 'E'),
    Re_ohm: fakeCell(6, 'E'),
    Sd_m2: fakeCell(0.02, 'E'),
  });
}

function completeDriver(): OpenISDDriver {
  const engine = new Engine();
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
      const cellOf = cellMap({Fs_hz: fakeCell(40, 'C', [engine.targetUnreachable('Fs_hz', 35)])});
      expect(dqNoteFor(cellOf, 'Fs_hz')).toBe('Fs_hz cannot reach this target - the maximum this geometry can reach is 35 Hz.');
    });

    it('is empty when the cell carries no dq marks', () => {
      const cellOf = cellMap({Fs_hz: fakeCell(40, 'E')});
      expect(dqNoteFor(cellOf, 'Fs_hz')).toBe('');
    });
  });

  describe('driverIssues', () => {
    it('returns no issues for a complete, consistent driver', () => {
      expect(driverIssues(completeDriver())).toEqual([]);
    });

    it('reports missing-dependencies for an incomplete driver', () => {
      const driver = OpenISDDriver.empty(new Engine());
      const issues = driverIssues(driver);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some(i => i.kind === 'missing-dependencies')).toBe(true);
    });
  });

  describe('chartBlockingReasonsFor', () => {
    it('is empty when every mandatory field is set and there are no issues', () => {
      expect(chartBlockingReasonsFor([], allMandatorySet())).toEqual([]);
    });

    it('names each not-available mandatory field', () => {
      const cellOf = cellMap({Fs_hz: fakeCell(40, 'E')});
      const reasons = chartBlockingReasonsFor([], cellOf);
      expect(reasons).toContainEqual({subject: 'Vas_m3', text: 'is not set'});
      expect(reasons).toContainEqual({subject: 'Re_ohm', text: 'is not set'});
      expect(reasons).toContainEqual({subject: 'Sd_m2', text: 'is not set'});
      expect(reasons.some(r => r.subject === 'Fs_hz')).toBe(false);
    });

    it('describes a missing-dependencies issue by its blocked routes', () => {
      const reasons = chartBlockingReasonsFor([engine.missingDependencies('Mms_kg',
        [{formula: 'Mms = Cms·Fs²', required: ['Cms_m_per_N', 'Fs_hz'], missing: ['Cms_m_per_N']}])], allMandatorySet());
      expect(reasons).toEqual([{subject: 'Mms_kg', text: 'cannot be calculated yet — needs Cms_m_per_N'}]);
    });

    // BUG_20260924: an inconsistent-inputs issue names values that are all PRESENT — they only
    // disagree with what the others imply. Nothing is absent, so no chart goes blank, and this
    // list must not claim one does.
    it('ignores inconsistent-inputs issues — every value they name exists, so no chart is blank', () => {
      const reasons = chartBlockingReasonsFor([engine.inconsistentInputs('Qts', ['Qts', 'Qes', 'Qms'], 'Qts = Qes·Qms/(Qes+Qms)', 0.4, 0.9, 1.25)], allMandatorySet());
      expect(reasons).toEqual([]);
    });

    it('keeps the missing-dependencies reason when both kinds are present', () => {
      const reasons = chartBlockingReasonsFor([
        engine.inconsistentInputs('Qts', ['Qts', 'Qes', 'Qms'], 'Qts = Qes·Qms/(Qes+Qms)', 0.4, 0.9, 1.25),
        engine.missingDependencies('Mms_kg',
        [{formula: 'Mms = Cms·Fs²', required: ['Cms_m_per_N', 'Fs_hz'], missing: ['Cms_m_per_N']}]),
      ], allMandatorySet());
      expect(reasons).toEqual([{subject: 'Mms_kg', text: 'cannot be calculated yet — needs Cms_m_per_N'}]);
    });
  });

  describe('inconsistentInputReasonsFor', () => {
    it('is empty when there are no issues', () => {
      expect(inconsistentInputReasonsFor([])).toEqual([]);
    });

    it('describes an inconsistent-inputs issue with its formula and disagreement', () => {
      const reasons = inconsistentInputReasonsFor([engine.inconsistentInputs('Qts', ['Qts', 'Qes', 'Qms'], 'Qts = Qes·Qms/(Qes+Qms)', 0.4, 0.9, 1.25)]);
      expect(reasons).toEqual([{subject: 'Qts', text: 'Qts = Qes·Qms/(Qes+Qms) — stated as 0.9, the others imply 0.4'}]);
    });

    it('ignores missing-dependencies issues — an absent value is the chart list\'s business', () => {
      const reasons = inconsistentInputReasonsFor([engine.missingDependencies('Mms_kg',
        [{formula: 'Mms = Cms·Fs²', required: ['Cms_m_per_N', 'Fs_hz'], missing: ['Cms_m_per_N']}])]);
      expect(reasons).toEqual([]);
    });
  });

  describe('ebpVal', () => {
    it('reads the driver EBP once Fs and Qes are both known', () => {
      const driver = completeDriver();
      expect(ebpVal(driver)).toBeCloseTo(40 / 0.45, 1);
    });

    it('is null before the driver can derive it', () => {
      const driver = OpenISDDriver.empty(new Engine());
      expect(ebpVal(driver)).toBeNull();
    });
  });
});
