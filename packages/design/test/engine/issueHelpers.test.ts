import {describe, expect, it} from 'vitest';
import type {CalculationIssue} from '../../engine/index.js';
import {Engine} from '../../engine/index.js';

type Q = 'a' | 'b' | 'c' | 'd';

const engine = new Engine();

describe('Engine.issueFields', () => {
  it('returns fields directly for an inconsistent-inputs issue', () => {
    const issue: CalculationIssue<Q> = {
      kind: 'inconsistent-inputs', target: 'a', fields: ['a', 'b'],
      formula: 'a = b', expected: 1, actual: 2, relative: 1,
    };
    expect(engine.issueFields(issue)).toEqual(['a', 'b']);
  });

  it('returns the target plus every route field for a missing-dependencies issue', () => {
    const issue: CalculationIssue<Q> = {
      kind: 'missing-dependencies', target: 'a',
      routes: [{ formula: 'a = b + c', required: ['b', 'c'], missing: ['c'] }],
    };
    expect(engine.issueFields(issue)).toEqual(['a', 'b', 'c', 'c']);
  });
});

describe('Engine.issueFormula', () => {
  it('returns the formula directly for an inconsistent-inputs issue', () => {
    const issue: CalculationIssue<Q> = {
      kind: 'inconsistent-inputs', target: 'a', fields: ['a', 'b'],
      formula: 'a = b', expected: 1, actual: 2, relative: 1,
    };
    expect(engine.issueFormula(issue)).toBe('a = b');
  });

  it('joins every route formula for a missing-dependencies issue', () => {
    const issue: CalculationIssue<Q> = {
      kind: 'missing-dependencies', target: 'a',
      routes: [
        { formula: 'a = b + c', required: ['b', 'c'], missing: ['c'] },
        { formula: 'a = d', required: ['d'], missing: ['d'] },
      ],
    };
    expect(engine.issueFormula(issue)).toBe('a = b + c; or a = d');
  });
});

describe('Engine.outOfRangeToText (D14)', () => {
  it('names the field, its value, and the limit it fell below', () => {
    const text = engine.outOfRangeToText({ kind: 'out-of-range', field: 'Qts', value: 0.02, limit: 0.1, side: 'below' });
    // decimal()'s own rule: below 0.1 in magnitude renders to 2 significant figures.
    expect(text).toBe('Qts 0.020 is below the physical limit 0.1.');
  });

  it('names the field, its value, and the limit it rose above', () => {
    const text = engine.outOfRangeToText({ kind: 'out-of-range', field: 'Qts', value: 12, limit: 2, side: 'above' });
    expect(text).toBe('Qts 12 is above the physical limit 2.');
  });
});

describe('Engine.dqIssueText — the shared \'out-of-range\' literal (D14)', () => {
  it('routes a driver-field out-of-range mark (named field/limit/side) to outOfRangeToText', () => {
    const text = engine.dqIssueText({ kind: 'out-of-range', field: 'Qts', value: 0.02, limit: 0.1, side: 'below' });
    expect(text).toBe('Qts 0.020 is below the physical limit 0.1.');
  });

  it('routes a vented-plausibility out-of-range mark (named quantity/min/max) to plausibilityToText', () => {
    const text = engine.dqIssueText({ kind: 'out-of-range', quantity: 'Fb', value: 400, min: 10, max: 150 });
    expect(text).toMatch(/plausible/);
  });
});
