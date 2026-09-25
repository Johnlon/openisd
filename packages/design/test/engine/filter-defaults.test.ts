/**
 * `Engine.defaultFilter(type)` — the one place a fresh filter's starting values live. The Filters
 * tab's quick-add buttons ask the engine; no UI file carries a defaults table of its own.
 */
import {describe, expect, it} from 'vitest';
import {Engine} from '../../engine/index.js';
import type {FilterType} from '../../engine/index.js';

const ALL: readonly FilterType[] = ['highpass', 'lowpass', 'linkwitz', 'peaking', 'lowshelf', 'highshelf'];

describe('Engine.defaultFilter', () => {
  it('a fresh filter of every type is enabled, carries its type, and has no list id (the UI mints that)', () => {
    const engine = new Engine();
    for (const type of ALL) {
      const a = engine.defaultFilter(type);
      expect(a.type).toBe(type);
      expect(a.enabled).toBe(true);
      expect(a.id).toBeUndefined();
    }
  });

  it('a high-pass starts at 80 Hz Butterworth and a Linkwitz transform at f0 50 / fp 20', () => {
    const engine = new Engine();
    const hp = engine.defaultFilter('highpass');
    expect(hp.fc).toBe(80);
    expect(hp.Q).toBeCloseTo(Math.SQRT1_2, 3);
    const lt = engine.defaultFilter('linkwitz');
    expect(lt.f0).toBe(50);
    expect(lt.Q0).toBe(0.7);
    expect(lt.fp).toBe(20);
    expect(lt.Qp).toBe(0.5);
  });

  it('a peaking EQ starts as a 6 dB cut at 300 Hz; shelves as 6 dB boosts', () => {
    const engine = new Engine();
    expect(engine.defaultFilter('peaking')).toMatchObject({fc: 300, Q: 1, gain: -6});
    expect(engine.defaultFilter('lowshelf')).toMatchObject({fc: 150, gain: 6});
    expect(engine.defaultFilter('highshelf')).toMatchObject({fc: 2000, gain: 6});
    expect(engine.defaultFilter('lowpass')).toMatchObject({fc: 200});
  });
});
