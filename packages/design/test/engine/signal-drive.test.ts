import {describe, expect, it} from 'vitest';
import {driveFromVoltage} from '../../engine/signal/SignalEngine.js';

describe('driveFromVoltage', () => {
  it.each([
    ['is V² / (Re + Rs)', 4, 6, 2, 2],
    ['ignores a negative series resistance', 4, 8, -3, 2],
    ['is 0 W when there is no resistance to draw power through', 2.83, 0, 0, 0],
  ])('%s', (_name, volts, Re, Rs, watts) => {
    expect(driveFromVoltage(volts, Re, Rs)).toBe(watts);
  });
});
