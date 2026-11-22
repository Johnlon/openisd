import {describe, expect, it} from 'vitest';
import {approximateCharts, isPositiveGeometry, issueFormula, requiredPositiveIssue, tuningGoalIssue} from '../../engine/consistency.js';

describe('requiredPositiveIssue', () => {
  it('says to use the Alignment button when the blank can be filled by it', () => {
    expect(requiredPositiveIssue('Vb', null, 'alignment')?.text).toBe(
      'Vb is blank - enter a value above 0, or calculate one with the Alignment button. '
      + 'Nothing that depends on it can be calculated until then.');
  });

  it('says only to enter a value when nothing else can fill it', () => {
    expect(requiredPositiveIssue('Vb', null)?.text).toBe(
      'Vb is blank - enter a value above 0. Nothing that depends on it can be calculated until then.');
  });
});

describe('issueFormula', () => {
  it('is the issue text for an approximate-charts issue, which has no formula', () => {
    const issue = approximateCharts<'Qes'>('Qes', ['Qes'], 'Charts use a fallback Q');
    expect(issueFormula(issue)).toBe('Charts use a fallback Q');
  });
});

// T930: the vent and passive-radiator solves share these two checks instead of each keeping a copy.
describe('tuningGoalIssue', () => {
  it('refuses a tuning goal of 0 Hz or below on the goal alone', () => {
    const zero = tuningGoalIssue(0);
    expect(zero?.kind).toBe('inconsistent-inputs');
    expect(zero?.target).toBe('tuning_goal_hz');
    expect(zero?.fields).toEqual(['tuning_goal_hz']);
    expect(tuningGoalIssue(-30)?.kind).toBe('inconsistent-inputs');
  });

  it('passes a goal above 0 Hz and a blank goal', () => {
    expect(tuningGoalIssue(35)).toBeNull();
    expect(tuningGoalIssue(null)).toBeNull();
  });
});

describe('isPositiveGeometry', () => {
  it('accepts only a number above 0', () => {
    expect(isPositiveGeometry(0.05)).toBe(true);
    expect(isPositiveGeometry(0)).toBe(false);
    expect(isPositiveGeometry(-1)).toBe(false);
    expect(isPositiveGeometry(Number.NaN)).toBe(false);
    expect(isPositiveGeometry(null)).toBe(false);
  });
});
