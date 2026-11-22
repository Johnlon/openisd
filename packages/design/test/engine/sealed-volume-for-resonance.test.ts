import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';

const engine = createEngine();
const DRIVER = {Fs: 37, Vas: 0.03, Qts: 0.38};

describe('sealed volume for a target Fsc', () => {
  it('gives the volume whose lossy Fsc is the target, lossy or lossless', () => {
    for (const losses of [{Ql: 10, Qa: 100}, {Ql: 5, Qa: 20}, {Ql: Infinity, Qa: Infinity}]) {
      for (const Fsc of [40, 55, 80, 150]) {
        const vb = engine.sealed.volumeForResonance({...DRIVER, ...losses}, Fsc);
        expect(vb).not.toBeNull();
        expect(engine.sealed.resonance({...DRIVER, ...losses, Vb: vb ?? NaN}).Fsc).toBeCloseTo(Fsc, 6);
      }
    }
  });

  it('matches the textbook lossless volume when there are no losses', () => {
    const vb = engine.sealed.volumeForResonance({...DRIVER, Ql: Infinity, Qa: Infinity}, 74);
    expect(vb).toBeCloseTo(DRIVER.Vas / ((74 / DRIVER.Fs) ** 2 - 1), 9);
  });

  it('is null at or below the driver Fs: no box lowers the resonance', () => {
    expect(engine.sealed.volumeForResonance({...DRIVER, Ql: 10, Qa: 100}, 37)).toBeNull();
    expect(engine.sealed.volumeForResonance({...DRIVER, Ql: 10, Qa: 100}, 20)).toBeNull();
  });
});

describe('sealed volume for a target lossy Qtc', () => {
  it('gives the volume whose lossy Qtc is the target', () => {
    for (const losses of [{Ql: 10, Qa: 100}, {Ql: 5, Qa: 20}, {Ql: Infinity, Qa: Infinity}]) {
      for (const Qtc of [0.5, 0.707, 1, 1.5]) {
        const vb = engine.sealed.volumeForLossyQtc({...DRIVER, ...losses}, Qtc);
        if (vb === null) continue;
        expect(engine.sealed.resonance({...DRIVER, ...losses, Vb: vb}).Qtc).toBeCloseTo(Qtc, 6);
      }
    }
  });

  it('matches the textbook lossless volume when there are no losses', () => {
    const vb = engine.sealed.volumeForLossyQtc({...DRIVER, Ql: Infinity, Qa: Infinity}, 0.707);
    expect(vb).toBeCloseTo(engine.sealed.volumeForQtc(DRIVER.Qts, DRIVER.Vas, 0.707) ?? NaN, 9);
  });

  it('is null at or below the driver Qts: no box lowers the Q', () => {
    expect(engine.sealed.volumeForLossyQtc({...DRIVER, Ql: 10, Qa: 100}, DRIVER.Qts)).toBeNull();
  });
});
