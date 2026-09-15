import { describe, it, expect } from 'vitest';
import { Engine } from '../../engine/index.js';
import type { CalculationIssue } from '../../engine/index.js';

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
