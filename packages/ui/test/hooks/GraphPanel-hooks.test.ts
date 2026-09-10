import { describe, it, expect } from 'vitest';
import { createMockGraphPanelAPI } from '../../src/hooks/GraphPanel-hooks.js';

describe('GraphPanel Hook API', () => {
  it('creates mock GraphPanel API', () => {
    const mock = createMockGraphPanelAPI();
    expect(mock.blocked.value).toBe(false);
    expect(mock.warnings.value.length).toBe(0);
    expect(mock.plotData.value).toBeNull();
  });

  it('allows dismissing warnings in mock mode', () => {
    const mock = createMockGraphPanelAPI();
    expect(mock.warningsDismissed.value).toBe(false);
    mock.dismissWarnings();
    expect(mock.warningsDismissed.value).toBe(true);
  });
});
