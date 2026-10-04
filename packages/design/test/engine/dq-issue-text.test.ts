import {describe, it, expect} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';
import type {CalculationIssue} from '../../engine/index.js';

const engine = createEngine();

describe('DqIssue text', () => {
  describe('a DqIssue reports its own text', () => {
    it('missing-dependencies names the target and the routes', () => {
      const issue = engine.issues.missingDependencies('Vas_m3', [
        {formula: 'Vas = f(Cms, Sd)', required: ['Cms_m_per_N', 'Sd_m2'], missing: ['Cms_m_per_N']},
      ]);
      assert.match(issue.text, /Vas_m3 cannot be calculated yet/);
      assert.match(issue.text, /Cms_m_per_N/);
    });

    it('inconsistent-inputs states the disagreement', () => {
      const issue = engine.issues.inconsistentInputs('Fs_hz', ['Fs_hz', 'Mms_kg'], 'Fs = f(Mms, Cms)', 45, 48.8, 0.085);
      assert.match(issue.text, /Fs_hz, Mms_kg disagree by 8.5%/);
    });

    it('out-of-range names the field, the value and the limit', () => {
      const issue = engine.issues.outOfRange('Re_ohm', 900, 800, 'above');
      assert.match(issue.text, /Re_ohm 900 is above the physical limit 800/);
    });

    it('target-unreachable states the ceiling', () => {
      const issue = engine.issues.targetUnreachable('length_m', 62.5);
      assert.match(issue.text, /maximum this geometry can reach is 62.5 Hz/);
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
        'Qts, Qes, Qms disagree by 95.3%: Qts = Qes·Qms/(Qes+Qms). Every field in the group is marked '
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
    it('names the target and the geometry\'s reachable ceiling', () => {
      const text = engine.issues.targetUnreachable('length_m', 42).text;
      expect(text).toMatch(/length_m/);
      expect(text).toMatch(/42 Hz/);
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
      expect(engine.issues.targetUnreachable('length_m', 42).text).toMatch(/length_m/);
    });
  });
});
