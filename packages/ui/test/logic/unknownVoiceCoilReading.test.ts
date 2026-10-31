import {describe, expect, it} from 'vitest';
import {unknownVoiceCoilReading} from '../../src/logic/unknownVoiceCoilReading.js';

describe('unknown voice-coil source readings', () => {
  it('explains a retained Re reading when it cannot be used as a simulation value', () => {
    expect(unknownVoiceCoilReading({specs: {woofer: {Re_ohm: {
      state: 'N', readings: {manufacturer_datasheet: {actual_reading: '6.6 ohms'}},
    }}}}, 'Re_ohm')).toEqual([
      'Manufacturer source reports Re as “6.6 ohms”. The voice-coil count or basis is not specified, so this reading is retained for reference and not used in simulation.',
    ]);
  });

  it('does not show an unavailable-reading note for an entered value or absent reading', () => {
    expect(unknownVoiceCoilReading({specs: {woofer: {BL_Tm: {state: 'E', value: 4.9}}}}, 'BL_Tm')).toEqual([]);
    expect(unknownVoiceCoilReading({specs: {woofer: {BL_Tm: {state: 'N'}}}}, 'BL_Tm')).toEqual([]);
  });
});
