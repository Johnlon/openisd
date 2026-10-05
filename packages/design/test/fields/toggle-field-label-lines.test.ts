/**
 * `ToggleField.labelLines`: the on-screen label split at its line breaks (John, 2026-10-05). Joined,
 * the lines are the label; the tooltip keeps the one-line label.
 */
import {describe, expect, it} from 'vitest';
import {ToggleField} from '../../fields/index.js';

describe('ToggleField.labelLines', () => {
  it('breaks the transmission-line label after "-model"', () => {
    expect(ToggleField.ADV_TLPORTMODEL.labelLines).toEqual(['Use "transmission line"-model', ' for port simulation']);
  });

  it('breaks "Simplified ABC intra-port velocity" after "intra-port"', () => {
    expect(ToggleField.ADV_WINISDABCINTRAPORTVELOCITY.labelLines).toEqual(['Simplified ABC intra-port', ' velocity']);
  });

  it('every other toggle is one line, and every label is its lines joined', () => {
    for (const f of ToggleField.ALL) {
      expect(f.labelLines.join(''), f.value).toBe(f.label);
      if (f !== ToggleField.ADV_TLPORTMODEL && f !== ToggleField.ADV_WINISDABCINTRAPORTVELOCITY) expect(f.labelLines, f.value).toEqual([f.label]);
    }
  });

  it('the tooltip keeps the one-line label', () => {
    expect(ToggleField.ADV_WINISDABCINTRAPORTVELOCITY.description).toMatch(/^Simplified ABC intra-port velocity: /);
  });
});
