import { describe, it, expect } from 'vitest';
import type { DriverIssue } from '@openisd/design/engine';
import { consistencyNote, fieldIsMandatoryAndUnsatisfied } from '../../src/logic/useDriverCells.js';

describe('consistencyNote', () => {
  it('returns "" for a field no issue names', () => {
    expect(consistencyNote([], 'Fs')).toBe('');
  });

  it('formats an inconsistent-inputs issue naming the field', () => {
    const issues: readonly DriverIssue[] = [{
      kind: 'inconsistent-inputs', target: 'Qts', fields: ['Qts', 'Qes', 'Qms'],
      formula: 'Qts = Qes·Qms/(Qes+Qms)', expected: 0.39, actual: 7.5, relative: 18.2,
    }];
    const note = consistencyNote(issues, 'Qts');
    expect(note).toContain('Qts, Qes, Qms disagree');
    expect(note).toContain('Qts = Qes·Qms/(Qes+Qms)');
  });

  it('formats a missing-dependencies issue naming the target field', () => {
    const issues: readonly DriverIssue[] = [{
      kind: 'missing-dependencies', target: 'Qts',
      routes: [{ formula: 'Qts = Qes·Qms/(Qes+Qms)', required: ['Qes', 'Qms'], missing: ['Qms'] }],
    }];
    const note = consistencyNote(issues, 'Qts');
    expect(note).toContain('Qts');
    expect(note).toContain('Qms');
  });

  it('formats a missing-dependencies issue for a field named only in a route, not the target', () => {
    const issues: readonly DriverIssue[] = [{
      kind: 'missing-dependencies', target: 'Qts',
      routes: [{ formula: 'Qts = Qes·Qms/(Qes+Qms)', required: ['Qes', 'Qms'], missing: ['Qms'] }],
    }];
    expect(consistencyNote(issues, 'Qes')).not.toBe('');
  });
});

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
