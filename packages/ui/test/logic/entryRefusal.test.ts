import {describe, expect, it} from 'vitest';
import {entryRefusal, type EntryBounds} from '../../src/logic/entryRefusal.js';

/** A box in litres showing two decimals, its SI band given in m³. */
function litres(over: Partial<EntryBounds> = {}): EntryBounds {
  return { label: 'Vas', unit: 'L', floor: 'positive', min: 0, max: 1, minimumReason: undefined, show: si => (si * 1000).toFixed(2), ...over };
}

describe('entryRefusal — may this be stored, and if not, what to enter', () => {
  it('accepts a value inside the band', () => {
    expect(entryRefusal(litres(), { kind: 'number', si: 0.03 })).toBe('');
  });

  it("refuses 0 for a 'positive' field whose band starts at 0, saying what to enter in the box's unit", () => {
    expect(entryRefusal(litres(), { kind: 'number', si: 0 }))
      .toBe('Vas must be greater than 0 — enter a value above 0, up to 1000.00 L.');
  });

  it("allows 0 for a 'non-negative' field and refuses a negative", () => {
    const le = litres({ label: 'Le', floor: 'non-negative' });
    expect(entryRefusal(le, { kind: 'number', si: 0 })).toBe('');
    expect(entryRefusal(le, { kind: 'number', si: -0.001 })).toBe('Le is below its minimum — enter a value between 0.00 and 1000.00 L.');
  });

  it('a temperature shown in °C is refused at or below absolute zero, said in °C (QO953.c14)', () => {
    const celsius = { label: 'Temperature', unit: '°C', floor: 'positive' as const, min: 0, max: 1000, minimumReason: undefined, show: (si: number) => (si - 273.15).toFixed(2) };
    expect(entryRefusal(celsius, { kind: 'number', si: 0 }))
      .toBe('Temperature must be greater than -273.15 °C — enter a value above -273.15, up to 726.85 °C.');
    expect(entryRefusal(celsius, { kind: 'number', si: 0.01 })).toBe('');
  });

  it('refuses above the maximum, naming the range', () => {
    const box = litres({ label: 'Box volume', min: 0.0001, max: 0.1, floor: 'none' });
    expect(entryRefusal(box, { kind: 'number', si: 0.2 })).toBe('Box volume is above its maximum — enter a value between 0.10 and 100.00 L.');
  });

  it('refuses text that is not a number', () => {
    expect(entryRefusal(litres(), { kind: 'not-a-number' })).toBe('Vas is not a number — enter a value above 0, up to 1000.00 L.');
  });

  it('a caller ceiling tighter than the registry (PR target tuning) is named as the maximum', () => {
    const fh = { label: 'Target tuning', unit: 'Hz', floor: 'positive' as const, min: 0, max: 48, minimumReason: undefined, show: (si: number) => si.toFixed(1) };
    expect(entryRefusal(fh, { kind: 'number', si: 60 })).toBe('Target tuning is above its maximum — enter a value above 0, up to 48.0 Hz.');
  });

  it('a field with a stated reason for its floor adds it to the below-minimum note (Peak HP Gpk, QO951.c9)', () => {
    const gpk = { label: 'Gpk', unit: 'dB', floor: 'none' as const, min: 0, max: 60, minimumReason: 'A 2nd-order high-pass cannot peak below its flat level.', show: (si: number) => si.toFixed(3) };
    expect(entryRefusal(gpk, { kind: 'number', si: -6 }))
      .toBe('Gpk is below its minimum — enter a value between 0.000 and 60.000 dB. A 2nd-order high-pass cannot peak below its flat level.');
    expect(entryRefusal(gpk, { kind: 'number', si: 0 })).toBe('');
  });
});
