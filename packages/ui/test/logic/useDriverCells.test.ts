import { describe, it, expect } from 'vitest';
import type { DriverIssue } from '@openisd/design/engine';
import { fieldIsMandatoryAndUnsatisfied } from '../../src/logic/useDriverCells.js';

describe('fieldIsMandatoryAndUnsatisfied', () => {
  it('is false when no issue mentions the field', () => {
    expect(fieldIsMandatoryAndUnsatisfied([], 'Qts')).toBe(false);
  });

  it('is true for the target of a missing-dependencies issue', () => {
    const issues: readonly DriverIssue[] = [{
      kind: 'missing-dependencies', target: 'Qts',
      routes: [{ formula: 'Qts = Qes·Qms/(Qes+Qms)', required: ['Qes', 'Qms'], missing: ['Qms'] }],
    }];
    expect(fieldIsMandatoryAndUnsatisfied(issues, 'Qts')).toBe(true);
  });

  it('is true for a field named in a blocked route\'s own requirements, not just the target', () => {
    const issues: readonly DriverIssue[] = [{
      kind: 'missing-dependencies', target: 'Qts',
      routes: [{ formula: 'Qts = Qes·Qms/(Qes+Qms)', required: ['Qes', 'Qms'], missing: ['Qms'] }],
    }];
    expect(fieldIsMandatoryAndUnsatisfied(issues, 'Qes')).toBe(true);
    expect(fieldIsMandatoryAndUnsatisfied(issues, 'Qms')).toBe(true);
  });

  it('is false for an inconsistent-inputs issue — that is a contradiction, not a missing field', () => {
    const issues: readonly DriverIssue[] = [{
      kind: 'inconsistent-inputs', target: 'Qts', fields: ['Qts', 'Qes', 'Qms'],
      formula: 'Qts = Qes·Qms/(Qes+Qms)', expected: 0.39, actual: 7.5, relative: 18.2,
    }];
    expect(fieldIsMandatoryAndUnsatisfied(issues, 'Qts')).toBe(false);
  });
});
