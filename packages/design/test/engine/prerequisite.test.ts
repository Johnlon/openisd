import {describe, expect, it} from 'vitest';
import type {DriverPrerequisite} from '../../engine/index.js';

describe('CalculationPrerequisite shape', () => {
  it('names an output and the fields missing to produce it', () => {
    const p: DriverPrerequisite = { output: 'maxspl', missing: ['Pe_W', 'Xmax_m'] };
    expect(p.output).toBe('maxspl');
    expect(p.missing).toEqual(['Pe_W', 'Xmax_m']);
  });
});
