import {describe, expect, it} from 'vitest';
import {approximateCharts, issueFormula, requiredPositiveIssue} from '../../engine/consistency.js';

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
