import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { createMockNumInputAPI } from '../../src/hooks/NumInput-hooks.js';

describe('NumInput Hook API', () => {
  it('creates mock NumInput API', () => {
    const mock = createMockNumInputAPI();
    expect(mock.display.value).toBe('10.00');
    expect(mock.focused.value).toBe(false);
    expect(mock.badEntry.value).toBe(false);
  });

  it('handles formatting and input operations in mock mode', () => {
    const mock = createMockNumInputAPI({
      display: ref('20.50'),
    });
    expect(mock.display.value).toBe('20.50');
    expect(() => mock.onFocus()).not.toThrow();
    expect(() => mock.onBlur()).not.toThrow();
  });
});
