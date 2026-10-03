import {describe, it, expect} from 'vitest';
import {spinnerStep} from '../fields/spinnerStep.js';

describe('spinnerStep — proportional spinner step from the shown text', () => {
  it('no positive number → "any"', () => {
    expect(spinnerStep('')).toBe('any');
    expect(spinnerStep('0')).toBe('any');
    expect(spinnerStep('abc')).toBe('any');
  });

  it('a power of ten one decade below the magnitude, sign ignored', () => {
    expect(spinnerStep('1234')).toBe('100');
    expect(spinnerStep('-250')).toBe('10');
  });

  it('never finer than the decimals shown', () => {
    expect(spinnerStep('50')).toBe('1');
    expect(spinnerStep('0.7')).toBe('0.1');
    expect(spinnerStep('12.5')).toBe('1');
    expect(spinnerStep('0.045')).toBe('0.001');
  });
});
