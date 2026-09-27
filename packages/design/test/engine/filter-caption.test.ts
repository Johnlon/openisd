/**
 * `Engine.filterCaption` — the Filters-tab list row caption, WinISD's exact wording per type
 * (brief: WinISD's Filters list captions, `winisd_research/runs/filter-add-all-1`). Every
 * literal string here is copied from that brief, not derived — a wrong formula shows up as a
 * wrong string, not a passing test with the wrong assumption baked into both sides.
 *
 * Moved from `packages/ui/test/logic/filterCaption.test.ts`: captions are WinISD format, not UI
 * logic, and now live on the filter classes in `../../engine/filters/` behind `Engine`'s door.
 */
import {describe, expect, it} from 'vitest';
import {Engine} from '../../engine/index.js';
import type {Filter} from '../../engine/index.js';

const engine = new Engine();

describe('Engine.filterCaption', () => {
  it('lowpass Butterworth', () => {
    const f: Filter = {type: 'lowpass', enabled: true, family: 'butterworth', order: 2, fc: 50, Q: 0.707};
    expect(engine.filterCaption(f)).toBe('Lowpass (Butterworth, n=2, fc=50.00 Hz)');
  });

  it('lowpass Linkwitz-Riley always shows n=4, whatever order holds', () => {
    const f: Filter = {type: 'lowpass', enabled: true, family: 'linkwitzRiley', order: 2, fc: 50, Q: 0.707};
    expect(engine.filterCaption(f)).toBe('Lowpass (Linkwitz-Riley, n=4, fc=50.00 Hz)');
  });

  it('lowpass User SOS adds Q at 3dp', () => {
    const f: Filter = {type: 'lowpass', enabled: true, family: 'sos', order: 2, fc: 100, Q: 0.707};
    expect(engine.filterCaption(f)).toBe('Lowpass (User SOS, n=2, fc=100.00 Hz, Q=0.707)');
  });

  it('highpass Bessel, same shape as lowpass', () => {
    const f: Filter = {type: 'highpass', enabled: true, family: 'bessel', order: 3, fc: 80, Q: 0.6};
    expect(engine.filterCaption(f)).toBe('Highpass (Bessel, n=3, fc=80.00 Hz)');
  });

  it('highpass Linkwitz-Riley forces n=4 too', () => {
    const f: Filter = {type: 'highpass', enabled: true, family: 'linkwitzRiley', order: 1, fc: 20, Q: 0.707};
    expect(engine.filterCaption(f)).toBe('Highpass (Linkwitz-Riley, n=4, fc=20.00 Hz)');
  });

  it('allpass order 1 carries no Q', () => {
    const f: Filter = {type: 'allpass', enabled: true, order: 1, t: 0.001, Q: 0.707};
    expect(engine.filterCaption(f)).toBe('Allpass (n=1, t=0.001 s)');
  });

  it('allpass order >= 2 adds Q at 2dp', () => {
    const f: Filter = {type: 'allpass', enabled: true, order: 3, t: 0.004, Q: 0.8};
    expect(engine.filterCaption(f)).toBe('Allpass (n=3, t=0.004 s, Q=0.80)');
  });

  it('linkwitz transform — space separated, no commas', () => {
    const f: Filter = {type: 'linkwitz', enabled: true, f0: 40.73, Q0: 0.39, fp: 20, Qp: 0.71};
    expect(engine.filterCaption(f)).toBe('Linkwitz transform (f0=40.73 Q0=0.39 fp=20.00 Qp=0.71)');
  });

  it('parametric EQ', () => {
    const f: Filter = {type: 'peaking', enabled: true, fc: 30, Q: 2, gain: 6};
    expect(engine.filterCaption(f)).toBe('Parametric EQ (fc=30.00 Hz, Q=2.00, Gain=6.00 dB)');
  });

  it('peaking 2nd order highpass — space separated, no comma', () => {
    const f: Filter = {type: 'peakHighpass', enabled: true, fpk: 20, gainPk: 6};
    expect(engine.filterCaption(f)).toBe('Peaking 2nd order highpass (Gpk=6.00 dB fpk=20.00 Hz)');
  });

  it('static gain', () => {
    const f: Filter = {type: 'staticGain', enabled: true, gain: 0};
    expect(engine.filterCaption(f)).toBe('Static gain (Gain=0.00 dB)');
  });

  it('DLP raised cosine', () => {
    const f: Filter = {type: 'raisedCosine', enabled: true, fc: 100, bwOct: 0.333, gain: 6};
    expect(engine.filterCaption(f)).toBe('DLP Raised Cosine (fc=100.00 Hz, BW=0.33 oct, Gain=6.00 dB)');
  });

  it('low shelf keeps the current summary style, prefixed', () => {
    const f: Filter = {type: 'lowshelf', enabled: true, fc: 150, Q: Math.SQRT1_2, gain: 6};
    expect(engine.filterCaption(f)).toBe('Low shelf (fc 150 Hz · Q 0.71 · 6.0 dB)');
  });

  it('high shelf keeps the current summary style, prefixed', () => {
    const f: Filter = {type: 'highshelf', enabled: true, fc: 2000, Q: Math.SQRT1_2, gain: 6};
    expect(engine.filterCaption(f)).toBe('High shelf (fc 2000 Hz · Q 0.71 · 6.0 dB)');
  });
});
