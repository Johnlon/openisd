/**
 * A Peaking 2nd order highpass whose peak gain is below 0 dB: WinISD closes when it is added
 * (winisd_research/runs/peakhp-negative-20261118/), the old OpenISD formula gave NaN and the
 * chart drew nothing without saying why. Now the filter contributes no curve (unity response),
 * the other filters' product stays right, and the engine raises an issue
 * (bugs/BUG_20261118_peak-highpass-negative-gain-nan.md).
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {applyFilters} from '../../engine/filters.js';
import {filterModel} from '../../engine/filters/index.js';
import type {Filter} from '../../engine/types.js';

const engine = createEngine();
const NO_ERRORS = {besselHighpass: false};
const negative: Filter = {type: 'peakHighpass', enabled: true, fpk: 50, gainPk: -6};
const positive: Filter = {type: 'peakHighpass', enabled: true, fpk: 50, gainPk: 6};
const FREQS = [10, 20, 35, 50, 80, 200, 1000];

describe('Peaking 2nd order highpass with a negative peak gain', () => {
  it('has no NaN in its response', () => {
    for (const f of FREQS) {
      const h = filterModel(negative, NO_ERRORS).response(f);
      expect(Number.isNaN(h.re) || Number.isNaN(h.im)).toBe(false);
    }
  });

  it('contributes no curve: the total with another filter is that filter alone', () => {
    const other: Filter = {type: 'staticGain', enabled: true, gain: 3};
    for (const f of FREQS) {
      const alone = applyFilters(f, [other], NO_ERRORS);
      const both = applyFilters(f, [negative, other], NO_ERRORS);
      expect(both.re).toBeCloseTo(alone.re, 12);
      expect(both.im).toBeCloseTo(alone.im, 12);
    }
  });

  it('raises an issue in the WinISD-but-so-OpenISD wording', () => {
    const issue = engine.filters.issue(negative);
    expect(issue).not.toBeNull();
    expect(issue?.text).toBe(
      'WinISD closes when this filter has a negative peak gain, but a peak gain below 0 dB has no curve to draw, '
      + 'so OpenISD keeps the value and draws no curve for this filter (here -6 dB at 50 Hz).');
  });

  it('raises no issue at 0 dB or above, and the positive curve is unchanged', () => {
    expect(engine.filters.issue(positive)).toBeNull();
    expect(engine.filters.issue({...positive, gainPk: 0})).toBeNull();
    const h = filterModel(positive, NO_ERRORS).response(50);
    expect(Math.hypot(h.re, h.im)).toBeGreaterThan(1.1);
  });
});
