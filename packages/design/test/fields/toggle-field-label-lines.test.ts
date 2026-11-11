/**
 * `ToggleField.labelLines`: the on-screen label split at its line breaks (John, 2026-10-05). Joined,
 * the lines are the label; the tooltip keeps the one-line label.
 */
import {describe, expect, it} from 'vitest';
import {ToggleField} from '../../fields/field.js';
describe('ToggleField.labelLines', () => {
  it('breaks the transmission-line label after "-model"', () => {
    expect(ToggleField.ADV_TLPORTMODEL.labelLines).toEqual(['Use "transmission line"-model', ' for port simulation']);
  });

  it('breaks "Simplified ABC intra-port velocity" after "intra-port"', () => {
    expect(ToggleField.ADV_WINISDABCINTRAPORTVELOCITY.labelLines).toEqual(['Simplified ABC intra-port', ' velocity']);
  });

  it('breaks "Chart from Fs, Vas, Qms (WinISD\'s way)" after "Qms"', () => {
    expect(ToggleField.ADV_WINISDCHARTFROMFSVASQMS.labelLines).toEqual(['Chart from Fs, Vas, Qms', " (WinISD's way)"]);
  });

  it('every other toggle is one line, and every label is its lines joined', () => {
    const broken: readonly ToggleField[] = [ToggleField.ADV_TLPORTMODEL, ToggleField.ADV_WINISDABCINTRAPORTVELOCITY, ToggleField.ADV_WINISDCHARTFROMFSVASQMS];
    for (const f of ToggleField.ALL) {
      expect(f.labelLines.join(''), f.value).toBe(f.label);
      if (!broken.includes(f)) expect(f.labelLines, f.value).toEqual([f.label]);
    }
  });

  it('the tooltip keeps the one-line label', () => {
    expect(ToggleField.ADV_WINISDABCINTRAPORTVELOCITY.description).toMatch(/^Simplified ABC intra-port velocity: /);
  });
});
