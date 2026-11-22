import {describe, expect, it} from 'vitest';
import {calculatedWiring, enteredWiring, VoiceCoilWiring} from '../../domain/voiceCoilWiring.js';
import {wdrVCConCode} from '../../domain/winIsdDriverImport.js';

describe('VCCon in the record is the wiring name (QO914, #514)', () => {
  it('an entered or calculated wiring entry holds the name, with no precision', () => {
    expect(enteredWiring(VoiceCoilWiring.Series)).toEqual({state: 'E', value: 'series'});
    expect(calculatedWiring(VoiceCoilWiring.Parallel)).toEqual({state: 'C', value: 'parallel'});
  });
});

describe('wdrVCConCode — the 1|2 code lives in the .wdr adapter only', () => {
  it('maps Parallel to 1 and Series to 2', () => {
    expect(wdrVCConCode(VoiceCoilWiring.Parallel)).toBe('1');
    expect(wdrVCConCode(VoiceCoilWiring.Series)).toBe('2');
  });

  it('an unknown wiring is written as 1, WinISD\'s default (QO900 R1)', () => {
    expect(wdrVCConCode(null)).toBe('1');
  });
});
