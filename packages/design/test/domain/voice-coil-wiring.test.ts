import {describe, expect, it} from 'vitest';
import {wiringFromRecord, VoiceCoilWiring} from '../../domain/voiceCoilWiring.js';

describe('wiringFromRecord — the VCCon 1|2 encoding, absence is not a wiring', () => {
  it('maps 1 to Parallel and 2 to Series', () => {
    expect(wiringFromRecord(1)).toBe(VoiceCoilWiring.Parallel);
    expect(wiringFromRecord(2)).toBe(VoiceCoilWiring.Series);
  });

  it('a number the encoding does not define, or null, reads as absence', () => {
    expect(wiringFromRecord(3)).toBeNull();
    expect(wiringFromRecord(null)).toBeNull();
  });
});
