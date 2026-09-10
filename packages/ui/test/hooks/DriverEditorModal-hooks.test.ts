import { describe, it, expect } from 'vitest';
import { createMockDriverEditorModalAPI } from '../../src/hooks/DriverEditorModal-hooks.js';

describe('DriverEditorModal Hook API', () => {
  it('creates default mock API with expected default values', () => {
    const mock = createMockDriverEditorModalAPI();
    expect(mock.editorTitle).toBe("Edit Project's Driver");
    expect(mock.activeTab.value).toBe('General');
    expect(mock.draftDriver.value).toBeDefined();
    expect(mock.draftDriver.value.brand.get().value).toBe('MockBrand');
    expect(mock.driverRaw.value.brand).toBe('MockBrand');
    expect(mock.renameQuestionOpen.value).toBe(false);
  });

  it('allows overriding mock API properties', () => {
    const mock = createMockDriverEditorModalAPI({
      editorTitle: 'Custom Driver Editor Title',
    });
    expect(mock.editorTitle).toBe('Custom Driver Editor Title');
  });

  it('provides dummy implementations for action handlers', () => {
    const mock = createMockDriverEditorModalAPI();
    expect(() => mock.save()).not.toThrow();
    expect(() => mock.cancel()).not.toThrow();
    expect(() => mock.setTab('Parameters')).not.toThrow();
  });
});
