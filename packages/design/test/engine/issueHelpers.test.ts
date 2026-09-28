import {describe, expect, it} from 'vitest';
import type {CalculationIssue} from '../../engine/index.js';
import {Engine} from '../../engine/index.js';

type Q = 'a' | 'b' | 'c' | 'd';

const engine = new Engine();

describe('a calculation issue names its own fields', () => {
  it('an inconsistent-inputs issue names the group it marks', () => {
    const issue: CalculationIssue<Q> = engine.inconsistentInputs<Q>('a', ['a', 'b'], 'a = b', 1, 2, 1);
    expect(issue.fields).toEqual(['a', 'b']);
  });

  it('a missing-dependencies issue names its target plus every route field', () => {
    const issue: CalculationIssue<Q> = engine.missingDependencies<Q>('a',
      [{ formula: 'a = b + c', required: ['b', 'c'], missing: ['c'] }]);
    expect(issue.fields).toEqual(['a', 'b', 'c', 'c']);
  });
});

describe('Engine.issueFormula', () => {
  it('returns the formula directly for an inconsistent-inputs issue', () => {
    const issue: CalculationIssue<Q> = engine.inconsistentInputs<Q>('a', ['a', 'b'], 'a = b', 1, 2, 1);
    expect(engine.issueFormula(issue)).toBe('a = b');
  });

  it('joins every route formula for a missing-dependencies issue', () => {
    const issue: CalculationIssue<Q> = engine.missingDependencies<Q>('a', [
      { formula: 'a = b + c', required: ['b', 'c'], missing: ['c'] },
      { formula: 'a = d', required: ['d'], missing: ['d'] },
    ]);
    expect(engine.issueFormula(issue)).toBe('a = b + c; or a = d');
  });
});

describe('outOfRange (D14)', () => {
  it('names the field, its value, and the limit it fell below', () => {
    // decimal()'s own rule: below 0.1 in magnitude renders to 2 significant figures.
    expect(engine.outOfRange('Qts', 0.02, 0.1, 'below').text)
      .toBe('Qts 0.020 is below the physical limit 0.1.');
  });

  it('names the field, its value, and the limit it rose above', () => {
    expect(engine.outOfRange('Qts', 12, 2, 'above').text).toBe('Qts 12 is above the physical limit 2.');
  });
});

// `out-of-range` is one kind name over two shapes — a driver field's band (field/limit/side) and
// a vented-alignment band (quantity/min/max). Each is built by its own factory, so the sentence
// is decided where the shape is known and no reader ever has to tell the two apart afterwards.
describe('the shared \'out-of-range\' kind, two shapes (D14)', () => {
  it('a driver-field breach names the field and the physical limit', () => {
    expect(engine.outOfRange('Qts', 0.02, 0.1, 'below').text)
      .toBe('Qts 0.020 is below the physical limit 0.1.');
  });

  it('a vented-alignment breach names the design band instead', () => {
    expect(engine.quantityOutOfBand('Fb', 400, 10, 150).text).toMatch(/plausible/);
  });
});
