import {describe, expect, it} from 'vitest';
import {blockedChartFixLine} from '../../fields/chartBlockText.js';

// QO955.c3/c4 (John, 19 Nov 2026): a chart that cannot be drawn names the field that causes it, on the phone
// with its tab too; it never points at "the listed inputs" when nothing is listed.
describe('the line under a blocked chart', () => {
  it('desktop names the field by its label', () => {
    expect(blockedChartFixLine(['length_m'], false)).toBe('Fix: Vent length');
  });

  it('phone adds the tab the field is on', () => {
    expect(blockedChartFixLine(['length_m'], true)).toBe('Fix: Vent length (Box tab)');
    expect(blockedChartFixLine(['Fs_hz'], true)).toBe('Fix: Fs (Driver tab)');
    expect(blockedChartFixLine(['power_W'], true)).toBe('Fix: System input power (Signal tab)');
    expect(blockedChartFixLine(['tempK'], true)).toBe('Fix: Temperature (Options)');
  });

  it('names each field once, in order', () => {
    expect(blockedChartFixLine(['length_m', 'Vb_m3', 'length_m'], false)).toBe('Fix: Vent length, Volume');
  });

  it('the vented and ABC tunings name its own tuning field', () => {
    expect(blockedChartFixLine(['Fr'], false)).toBe('Fix: Tuning freq (Frc)');
    expect(blockedChartFixLine(['Ff'], false)).toBe('Fix: Tuning freq (Ffc)');
    expect(blockedChartFixLine(['Fb'], false)).toBe('Fix: Tuning freq (Fb)');
  });

  it('with no field to name it never says "listed"', () => {
    for (const phone of [false, true]) {
      const line = blockedChartFixLine(['sweep:SPL'], phone);
      expect(line).toBe('Change an input to restore this chart.');
      expect(line).not.toMatch(/listed/);
    }
    expect(blockedChartFixLine([], false)).not.toMatch(/listed/);
  });
});
