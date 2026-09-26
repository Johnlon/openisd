/**
 * The chart view (sweep range, per-chart Y ranges) travels in the saved view state, so it
 * survives a restart. bugs/BUG_20260926_sweep-range-and-y-ranges-not-persisted.md
 */
import {describe, expect, it} from 'vitest';
import {applyViewSnapshot, currentViewSnapshot} from '../../src/logic/appState.js';
import {presentationState} from '../../src/logic/presentationState.js';

describe('view snapshot — chart ranges', () => {
  it('currentViewSnapshot carries the sweep range and Y ranges', () => {
    presentationState.sweepRange = {min: 1.111, max: 22222};
    presentationState.yRanges = {SPL: {min: -11, max: 111}};

    expect(currentViewSnapshot().chart).toEqual({sweepRange: {min: 1.111, max: 22222}, yRanges: {SPL: {min: -11, max: 111}}});
  });

  it('applyViewSnapshot restores the sweep range and Y ranges', () => {
    applyViewSnapshot({ui: {}, chart: {sweepRange: {min: 3.333, max: 4444}, yRanges: {Zmag: {min: 5, max: 55}}}});

    expect(presentationState.sweepRange).toEqual({min: 3.333, max: 4444});
    expect(presentationState.yRanges).toEqual({Zmag: {min: 5, max: 55}});
  });
});
