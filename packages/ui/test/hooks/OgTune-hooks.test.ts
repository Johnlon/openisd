import { describe, it, expect } from 'vitest';
import { createMockOgTuneAPI } from '../../src/hooks/OgTune-hooks.js';

describe('OgTune Hook API', () => {
  it('creates mock OgTune API', () => {
    const mock = createMockOgTuneAPI();
    expect(mock.ebp.value).toBe(50);
    expect(mock.cellClass('Fs')).toBe('cell-ok');
    expect(mock.cellVal('Fs')).toBe(30);
  });

  it('handles field updates in mock mode', () => {
    const mock = createMockOgTuneAPI();
    expect(() => mock.enterField('Fs', 35)).not.toThrow();
    expect(() => mock.clearField('Fs')).not.toThrow();
  });
});
