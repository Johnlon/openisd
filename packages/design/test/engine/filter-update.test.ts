/**
 * `Engine.updateXFilter` — one typed edit method per filter class, the core's own decision on
 * what a filter EDITOR is allowed to write: order rounded to the nearest integer then clamped to
 * WinISD's Filter Editor entry range (1..10), every other numeric field clamped to its own entry
 * range (`packages/design/fields/filterLimits.ts`). Every `*Editor.vue` calls one of these and
 * emits the result — it owns no rounding or clamping of its own
 * (bugs/BUG_20260927_filter-editors-hold-domain-logic.md).
 *
 * Rounding/clamp order for `order`: round first, then clamp — 2.6 rounds to 3 (in range, no
 * clamp needed); 0 rounds to 0, then clamps up to the 1 floor.
 */
import {describe, expect, it} from 'vitest';
import {Engine} from '../../engine/index.js';
import type {Filter} from '../../engine/index.js';

const engine = new Engine();

describe('Engine.updatePassFilter', () => {
  const base: Extract<Filter, {type: 'lowpass'}> =
    {type: 'lowpass', enabled: true, family: 'butterworth', order: 2, fc: 50, Q: 0.707};

  it('rounds a fractional order to the nearest integer: 2.6 -> 3', () => {
    expect(engine.updatePassFilter(base, {order: 2.6}).order).toBe(3);
  });

  it('clamps order at the 1..10 floor: 0 -> 1', () => {
    expect(engine.updatePassFilter(base, {order: 0}).order).toBe(1);
  });

  it('clamps an out-of-range fc to the entry ceiling', () => {
    expect(engine.updatePassFilter(base, {fc: 999999}).fc).toBe(20000);
  });

  it('leaves every other field untouched and keeps the variant', () => {
    const next = engine.updatePassFilter(base, {fc: 100});
    expect(next.type).toBe('lowpass');
    expect(next.family).toBe('butterworth');
    expect(next.order).toBe(2);
    expect(next.Q).toBe(0.707);
    expect(next.enabled).toBe(true);
  });

  it('preserves the highpass variant too', () => {
    const hp: Extract<Filter, {type: 'highpass'}> =
      {type: 'highpass', enabled: true, family: 'bessel', order: 4, fc: 20, Q: 0.5};
    expect(engine.updatePassFilter(hp, {order: 2.6}).type).toBe('highpass');
  });
});

describe('Engine.updateAllpassFilter', () => {
  const base: Extract<Filter, {type: 'allpass'}> = {type: 'allpass', enabled: true, order: 1, t: 0.001, Q: 0.707};

  it('rounds a fractional order to the nearest integer: 2.6 -> 3', () => {
    expect(engine.updateAllpassFilter(base, {order: 2.6}).order).toBe(3);
  });

  it('clamps order at the 1..10 floor: 0 -> 1', () => {
    expect(engine.updateAllpassFilter(base, {order: 0}).order).toBe(1);
  });

  it('clamps an out-of-range Q to the entry ceiling', () => {
    expect(engine.updateAllpassFilter(base, {Q: 5000}).Q).toBe(100);
  });

  it('leaves t untouched and keeps the variant', () => {
    const next = engine.updateAllpassFilter(base, {Q: 1});
    expect(next.type).toBe('allpass');
    expect(next.t).toBe(0.001);
  });
});

describe('Engine.updateLinkwitzFilter', () => {
  const base: Extract<Filter, {type: 'linkwitz'}> =
    {type: 'linkwitz', enabled: true, f0: 50, Q0: 0.7, fp: 20, Qp: 0.5};

  it('clamps an out-of-range f0 to the entry ceiling', () => {
    expect(engine.updateLinkwitzFilter(base, {f0: 999999}).f0).toBe(20000);
  });

  it('clamps an out-of-range Q0 to the entry floor', () => {
    expect(engine.updateLinkwitzFilter(base, {Q0: 0.0001}).Q0).toBe(0.1);
  });

  it('leaves fp/Qp untouched and keeps the variant', () => {
    const next = engine.updateLinkwitzFilter(base, {f0: 60});
    expect(next.type).toBe('linkwitz');
    expect(next.fp).toBe(20);
    expect(next.Qp).toBe(0.5);
  });
});

describe('Engine.updateParametricEqFilter', () => {
  const base: Extract<Filter, {type: 'peaking'}> = {type: 'peaking', enabled: true, fc: 30, Q: 2, gain: 6};

  it('clamps an out-of-range gain to the entry ceiling', () => {
    expect(engine.updateParametricEqFilter(base, {gain: 999}).gain).toBe(60);
  });

  it('leaves fc/Q untouched and keeps the variant', () => {
    const next = engine.updateParametricEqFilter(base, {gain: 3});
    expect(next.type).toBe('peaking');
    expect(next.fc).toBe(30);
    expect(next.Q).toBe(2);
  });
});

describe('Engine.updatePeakHighpassFilter', () => {
  const base: Extract<Filter, {type: 'peakHighpass'}> = {type: 'peakHighpass', enabled: true, fpk: 20, gainPk: 6};

  it('clamps an out-of-range fpk to the entry floor', () => {
    expect(engine.updatePeakHighpassFilter(base, {fpk: -5}).fpk).toBe(1);
  });

  it('leaves gainPk untouched and keeps the variant', () => {
    const next = engine.updatePeakHighpassFilter(base, {fpk: 30});
    expect(next.type).toBe('peakHighpass');
    expect(next.gainPk).toBe(6);
  });
});

describe('Engine.updateStaticGainFilter', () => {
  const base: Extract<Filter, {type: 'staticGain'}> = {type: 'staticGain', enabled: true, gain: 0};

  it('clamps an out-of-range gain to the entry floor', () => {
    expect(engine.updateStaticGainFilter(base, {gain: -999}).gain).toBe(-60);
  });

  it('keeps the variant', () => {
    expect(engine.updateStaticGainFilter(base, {gain: 3}).type).toBe('staticGain');
  });
});

describe('Engine.updateRaisedCosineFilter', () => {
  const base: Extract<Filter, {type: 'raisedCosine'}> =
    {type: 'raisedCosine', enabled: true, fc: 100, bwOct: 0.333, gain: 6};

  it('clamps an out-of-range bwOct to the entry ceiling', () => {
    expect(engine.updateRaisedCosineFilter(base, {bwOct: 50}).bwOct).toBe(10);
  });

  it('leaves fc/gain untouched and keeps the variant', () => {
    const next = engine.updateRaisedCosineFilter(base, {bwOct: 0.5});
    expect(next.type).toBe('raisedCosine');
    expect(next.fc).toBe(100);
    expect(next.gain).toBe(6);
  });
});

describe('Engine.updateShelfFilter', () => {
  const base: Extract<Filter, {type: 'lowshelf'}> = {type: 'lowshelf', enabled: true, fc: 150, Q: Math.SQRT1_2, gain: 6};

  it('clamps an out-of-range fc to the entry ceiling', () => {
    expect(engine.updateShelfFilter(base, {fc: 999999}).fc).toBe(20000);
  });

  it('clamps an out-of-range gain to the entry floor', () => {
    expect(engine.updateShelfFilter(base, {gain: -999}).gain).toBe(-60);
  });

  it('leaves Q untouched and preserves each variant', () => {
    const next = engine.updateShelfFilter(base, {fc: 200});
    expect(next.type).toBe('lowshelf');
    expect(next.Q).toBe(Math.SQRT1_2);

    const hs: Extract<Filter, {type: 'highshelf'}> = {type: 'highshelf', enabled: true, fc: 2000, Q: Math.SQRT1_2, gain: 6};
    expect(engine.updateShelfFilter(hs, {fc: 2500}).type).toBe('highshelf');
  });
});
