import {readFileSync} from 'node:fs';
import {describe, it, expect} from 'vitest';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {formatSignificant} from '../../fields/format.js';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/Engine.js';
import type {CalculationIssue} from '../../engine/consistency.js';
const engine = createEngine();

const BC_18NW100_4 = readFileSync(
  new URL('../../../ui/public/drivers/b-c-speakers/18nw100-4.json', import.meta.url), 'utf-8');

describe('DqIssue text', () => {
  describe('a DqIssue reports its own text', () => {

    it('target-unreachable states the ceiling', () => {
      const issue = engine.issues.targetUnreachable('length_m', 62.5);
      assert.match(issue.text, /The highest it can reach is 62.5 Hz/);
    });

    it('target-unreachable states natural tuning ceiling for PR addedMass_kg', () => {
      const issue = engine.issues.targetUnreachable('addedMass_kg', 63.3);
      assert.match(issue.text, /Target tuning frequency \(Fh\) cannot be higher than the natural box tuning of 63.3 Hz \(with 0 added mass\)/);
    });

    it('invalid-value and negative-value say what is kept', () => {
      // Both answer `null` for a value that passes their floor; -1 passes neither.
      const invalid = engine.issues.positiveValueIssue(-1);
      const negative = engine.issues.nonNegativeValueIssue(-1);
      assert.ok(invalid !== null && negative !== null, '-1 must break both floors');
      assert.match(invalid.text, /zero or less is not a physical value/);
      assert.match(negative.text, /less than zero is not a physical value/);
    });
  });

  describe('a calculation issue\'s own sentence', () => {
    it('renders a missing-dependencies issue as "<target> cannot be calculated yet - state <routes>."', () => {
      const issue: CalculationIssue<string> = engine.issues.missingDependencies<string>('Qts',
        [{formula: 'Qts = Qes·Qms/(Qes+Qms)', required: ['Qes', 'Qms'], missing: ['Qms']}]);
      expect(issue.text).toBe(
        'Qts cannot be calculated yet - state Qts = Qes·Qms/(Qes+Qms) (needs Qms).',
      );
    });

    it('renders an inconsistent-inputs issue as "<fields> disagree by <pct>: <formula>. Every field..."', () => {
      const issue: CalculationIssue<string> = engine.issues.inconsistentInputs<string>(
        'Qts', ['Qts', 'Qes', 'Qms'], 'Qts = Qes·Qms/(Qes+Qms)', 1, 1.953, 0.953);
      expect(issue.text).toBe(
        'Qts, Qes, Qms disagree by 48.8%: Qts = Qes·Qms/(Qes+Qms). Every field in the group is marked '
        + '- correct one of them, or clear one to let it be calculated.',
      );
    });
  });

  describe('a vented-plausibility issue\'s own sentence', () => {
    it('states the value and its unit, and does not claim WinISD agrees, for a non-physical answer', () => {
      const text = engine.issues.nonPhysicalQuantity('Vb', -0.02).text;
      expect(text).toMatch(/-20 L/);
      expect(text).toMatch(/not a physical/i);
      expect(text).not.toMatch(/WinISD/);
    });

    it('states the band a value fell outside', () => {
      const text = engine.issues.quantityOutOfBand('Vb', 1.684, 0.001, 1.0).text;
      expect(text).toMatch(/1684 L/);
      expect(text).toMatch(/1 L/);
      expect(text).toMatch(/1000 L/);
      expect(text).toMatch(/Settings/);
    });

    it('prints tuning in Hz', () => {
      const text = engine.issues.quantityOutOfBand('Fb', 5.4, 10, 150).text;
      expect(text).toMatch(/5\.4 Hz/);
      expect(text).toMatch(/10 Hz/);
      expect(text).toMatch(/150 Hz/);
    });

    it('renders a sub-0.1 value to two significant figures instead of rounding it to zero', () => {
      expect(engine.issues.nonPhysicalQuantity('Vb', 0.00005).text).toMatch(/0\.050 L/);
    });

    it('renders exactly zero as 0, not -0 or a precision string', () => {
      expect(engine.issues.nonPhysicalQuantity('Vb', 0).text).toMatch(/\bis 0 L\b/);
    });
  });

  describe('a target-unreachable issue\'s own sentence', () => {
    it('states the reachable ceiling in plain words, with no internal key', () => {
      const text = engine.issues.targetUnreachable('length_m', 42).text;
      expect(text).toBe("This port can't reach that tuning. The highest it can reach is 42 Hz.");
    });

    it('prints a non-finite ceiling as the literal string, not a formatted number', () => {
      expect(engine.issues.targetUnreachable('length_m', Infinity).text).toMatch(/Infinity Hz/);
    });
  });

  describe('every DqIssue kind carries its own sentence', () => {
    it('each factory decides the text at construction, so no reader has to dispatch on kind', () => {
      expect(engine.issues.missingDependencies<string>('Qts', []).text).toMatch(/Qts/);
      expect(engine.issues.inconsistentInputs<string>('Qts', ['Qts'], 'f', 1, 2, 1).text).toMatch(/disagree/);
      expect(engine.issues.nonPhysicalQuantity('Vb', -1).text).toMatch(/not a physical/i);
      expect(engine.issues.quantityOutOfBand('Fb', 1, 10, 20).text).toMatch(/plausible/);
      expect(engine.issues.targetUnreachable('length_m', 42).text).toMatch(/42 Hz/);
    });
  });

  describe('the gap an inconsistent-inputs warning prints', () => {
    it('a tiny nonzero gap keeps enough digits to be nonzero, never 0.0%', () => {
      const text = (actual: number): string => engine.issues.inconsistentInputs<string>('Qts', ['Qts', 'Qes'], 'f', 1, actual, 0).text;
      expect(text(1.0004)).toContain('disagree by 0.040%');
      expect(text(1.000004)).toContain('disagree by 0.00040%');
      expect(text(1.5)).toContain('disagree by 33.3%');
      expect(text(1.002)).toContain('disagree by 0.2%');
    });

    // BUG_20261104_driver-consistency-gap-shown-as-zero: BL stated 24.7 Tm, implied 26.748 Tm.
    it('B&C 18NW100-4 BL states the real stated-vs-implied gap (7.7%), not 0.0%', () => {
      const driver = OpenISDDriver.fromConformingRecord(JSON.parse(BC_18NW100_4), engine);
      if (Array.isArray(driver)) throw new Error(driver.join('; '));
      const bl = driver.dataQualityWarnings().find(w => w.field === 'BL_Tm');
      expect(bl?.message).toMatch(/disagree by 7\.7%/);
      expect(bl?.message).not.toMatch(/0\.0%/);
    });
  });
});

describe('formatSignificant', () => {
  it('rounds to 3 significant figures, keeping trailing zeros', () => {
    expect(formatSignificant(24.7)).toBe('24.7');
    expect(formatSignificant(26.74834)).toBe('26.7');
    expect(formatSignificant(30)).toBe('30.0');
    expect(formatSignificant(32.56)).toBe('32.6');
    expect(formatSignificant(1234.5)).toBe('1235');
    expect(formatSignificant(0.000123456)).toBe('0.000123');
  });
});
