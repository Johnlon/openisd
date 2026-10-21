import {describe, expect, it} from 'vitest';
import {AboutText, ImportChoiceText} from '../../fields/index.js';

describe('ImportChoiceText', () => {
  it('uses John\'s two choices', () => {
    expect(ImportChoiceText.ADD_LABEL).toBe("Add the settings in the file to the app's state");
    expect(ImportChoiceText.REPLACE_LABEL).toBe('Replace all');
    expect(ImportChoiceText.ADD_LINE).toContain('update & append');
  });
});

describe('AboutText.versionLine', () => {
  it('names a numbered build by version and day', () => {
    expect(AboutText.versionLine('7.0.952', '20261016T0900Z')).toBe('Version 7.0.952 · 16 Oct 2026');
  });
  it('names a build with no public number by its day', () => {
    expect(AboutText.versionLine('', '20261016T0900Z')).toBe('Build · 16 Oct 2026');
  });
});
