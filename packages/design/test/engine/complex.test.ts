import {describe, expect, it} from 'vitest';
import {cTanh, cx} from '../../engine/complex.js';

describe('cTanh', () => {
  it('matches (e^2z - 1)/(e^2z + 1) away from saturation', () => {
    const a = cx(0.3, 0.7);
    // e^(2z) = e^(2x)·(cos 2y + i sin 2y)
    const m = Math.exp(0.6);
    const e = cx(m * Math.cos(1.4), m * Math.sin(1.4));
    const den = (e.re + 1) ** 2 + e.im ** 2;
    const want = cx(((e.re - 1) * (e.re + 1) + e.im * e.im) / den, (e.im * (e.re + 1) - (e.re - 1) * e.im) / den);
    const got = cTanh(a);
    expect(got.re).toBeCloseTo(want.re, 12);
    expect(got.im).toBeCloseTo(want.im, 12);
  });

  it('is exactly +1 and -1 once |2x| passes the saturation point, instead of NaN', () => {
    expect(cTanh(cx(30, 5))).toEqual({re: 1, im: 0});
    expect(cTanh(cx(-30, 5))).toEqual({re: -1, im: 0});
  });
});
