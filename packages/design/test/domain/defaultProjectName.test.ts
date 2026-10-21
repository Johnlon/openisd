import {describe, expect, it} from 'vitest';
import {defaultProjectName} from '../../domain/project/defaultProjectName.js';

describe('defaultProjectName', () => {
  it('is "<driver model> <box type>"', () => {
    expect(defaultProjectName('W5-1138SMF', 'vented')).toBe('W5-1138SMF vented');
  });

  it('says every box type in words', () => {
    expect(defaultProjectName('RS225', 'sealed')).toBe('RS225 closed');
    expect(defaultProjectName('RS225', 'box-passive-radiator')).toBe('RS225 passive radiator');
    expect(defaultProjectName('RS225', 'bandpass4')).toBe('RS225 4th order bandpass');
    expect(defaultProjectName('RS225', 'bandpass6')).toBe('RS225 6th order bandpass');
    expect(defaultProjectName('RS225', 'abc')).toBe('RS225 ABC');
  });

  it('trims the driver model', () => {
    expect(defaultProjectName('  W5-1138SMF  ', 'vented')).toBe('W5-1138SMF vented');
  });

  it('is just the box type when the driver has no model', () => {
    expect(defaultProjectName('', 'vented')).toBe('vented');
    expect(defaultProjectName('   ', 'sealed')).toBe('closed');
  });
});
