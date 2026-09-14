import { describe, expect, it } from 'vitest';
import { errorsForChart } from '../../src/logic/series.js';

describe('chart error selection', () => {
  it('does not block SPL for failures in unrelated sweep outputs', () => {
    const errors = [
      { level: 'error' as const, field: 'sweep:phase', message: 'phase failed' },
      { level: 'error' as const, field: 'sweep:exc', message: 'excursion failed' },
      { level: 'error' as const, field: 'Vb', message: 'box volume failed' },
    ];

    expect(errorsForChart('SPL', errors).map(error => error.field)).toEqual(['Vb']);
    expect(errorsForChart('Phase', errors).map(error => error.field)).toEqual(['sweep:phase', 'Vb']);
  });
});
