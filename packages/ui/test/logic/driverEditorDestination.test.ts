import {describe, expect, it} from 'vitest';
import {driverEditorTabFor} from '../../src/logic/driverEditorDestination.js';

describe('driverEditorTabFor', () => {
  it('locates a dimension, an advanced field and a parameter', () => {
    expect(driverEditorTabFor('weight_kg')).toBe('Dimensions');
    expect(driverEditorTabFor('Rt_K_per_W')).toBe('Advanced');
    expect(driverEditorTabFor('Fs_hz')).toBe('Parameters');
    expect(driverEditorTabFor('brand')).toBe('General');
    expect(driverEditorTabFor('model')).toBe('General');
  });
});
