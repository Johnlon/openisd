import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';

const engine = createEngine();
const DRIVER = {Fs: 37, Vas: 0.03, Qts: 0.38};

describe('SealedEngine.volumeForLossyQtc', () => {
  it('is null when no volume reaches the target because the leakage alone sets a higher Q', () => {
    // Ql 0.5 loads the driver so much that Qtc stays above 0.707 even in a vast box.
    const lossy = {...DRIVER, Ql: 0.5, Qa: Infinity};
    expect(engine.sealed.volumeForLossyQtc(lossy, 0.707)).toBeNull();
  });
});

describe('SealedEngine.winisdPickerVolume', () => {
  const OK = {Vas: 0.03, Qes: 0.4, Qms: 4, Re: 6};

  it('gives a volume for a physical driver', () => {
    expect(engine.sealed.winisdPickerVolume(OK, 0.707)).toBeGreaterThan(0);
  });

  it.each([['Vas'], ['Qes'], ['Qms'], ['Re']] as const)('is null when %s is zero', (field) => {
    expect(engine.sealed.winisdPickerVolume({...OK, [field]: 0}, 0.707)).toBeNull();
  });
});
