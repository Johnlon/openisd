/**
 * `Engine.filters.default(type)` — the one place a fresh filter's starting values live. The Filters
 * tab's quick-add buttons ask the engine; no UI file carries a defaults table of its own.
 *
 * WinISD's own Filter Editor "Add" defaults for its 8 types:
 * winisd_research/PROBE_FINDINGS.md "`.wpr` `[Filters]` format", Add defaults column.
 * Linkwitz transform and the two OpenISD-only shelves keep the values OpenISD already shipped.
 */
import {describe, expect, it} from 'vitest';
import {Engine} from '../../engine/index.js';
import type {FilterType} from '../../engine/index.js';

const ALL: readonly FilterType[] = [
  'lowpass', 'highpass', 'allpass', 'linkwitz', 'peaking',
  'peakHighpass', 'staticGain', 'raisedCosine', 'lowshelf', 'highshelf',
];

describe('FilterEngine.default', () => {
  it('a fresh filter of every type is enabled, carries its type, and has no list id (the UI mints that)', () => {
    const engine = new Engine();
    for (const type of ALL) {
      const a = engine.filters.default(type);
      expect(a.type).toBe(type);
      expect(a.enabled).toBe(true);
      expect(a.id).toBeUndefined();
    }
  });

  it('lowpass starts Butterworth order 2 at 50 Hz, Q 0.707', () => {
    const lp = new Engine().filters.default('lowpass');
    expect(lp).toMatchObject({family: 'butterworth', order: 2, fc: 50, Q: 0.707});
  });

  it('highpass starts Butterworth order 2 at 20 Hz, Q 0.707', () => {
    const hp = new Engine().filters.default('highpass');
    expect(hp).toMatchObject({family: 'butterworth', order: 2, fc: 20, Q: 0.707});
  });

  it('allpass starts order 1, t 1 ms, Q 0.707', () => {
    const ap = new Engine().filters.default('allpass');
    expect(ap).toMatchObject({order: 1, t: 0.001, Q: 0.707});
  });

  it('a Linkwitz transform starts at f0 50 / Q0 0.7, fp 20 / Qp 0.5', () => {
    const lt = new Engine().filters.default('linkwitz');
    expect(lt).toMatchObject({f0: 50, Q0: 0.7, fp: 20, Qp: 0.5});
  });

  it('a parametric EQ starts fc 30, Q 2, +6 dB', () => {
    const peq = new Engine().filters.default('peaking');
    expect(peq).toMatchObject({fc: 30, Q: 2, gain: 6});
  });

  it('a peaking 2nd-order highpass starts fpk 20, +6 dB', () => {
    const php = new Engine().filters.default('peakHighpass');
    expect(php).toMatchObject({fpk: 20, gainPk: 6});
  });

  it('a static gain starts at 0 dB', () => {
    const gain = new Engine().filters.default('staticGain');
    expect(gain).toMatchObject({gain: 0});
  });

  it('a DLP Raised Cosine starts fc 100, BW 0.333 oct, +6 dB', () => {
    const rc = new Engine().filters.default('raisedCosine');
    expect(rc).toMatchObject({fc: 100, bwOct: 0.333, gain: 6});
  });

  it('the shelves keep OpenISD\'s own defaults: low-shelf 150 Hz, high-shelf 2000 Hz, both +6 dB', () => {
    expect(new Engine().filters.default('lowshelf')).toMatchObject({fc: 150, gain: 6});
    expect(new Engine().filters.default('highshelf')).toMatchObject({fc: 2000, gain: 6});
  });
});
