/**
 * The six Tune limits: parsing what is typed, and the colour state a value gets against a limit.
 * Amber within 10 % of the limit, red over it, none when either side is blank.
 */
import {describe, expect, it} from 'vitest';
import {
  LimitKind, LimitState, TuneLimits, TuneStates, limitState, parseLimit,
  F3Limit_hz, VolumeLimit_L, VentSpeedLimit_m_per_s, VentLengthLimit_cm, ExcursionLimit_mm, VentDiameterLimit_cm,
} from '../../domain/project/tuneLimits.js';
import type {LimitState as State, TuneReading} from '../../domain/project/tuneLimits.js';
import {TuneText} from '../../fields/tuneText.js';

const READING: TuneReading = {
  f3_hz: 40, vb_L: 20, ventSpeed_m_per_s: 15, ventLength_cm: 30, excursion_mm: 5, ventDiameter_cm: 8,
};

describe('limitState, at-most kinds (value must stay at or under the limit)', () => {
  const limit = VolumeLimit_L.of(10);
  const state = (value: number | null) => limitState(LimitKind.VB_MAX, value, limit);

  it('is ok with room to spare, reporting the margin as a fraction of the limit', () => {
    expect(state(5)).toEqual({kind: 'ok', margin: 0.5});
  });
  it('is amber from 90 % of the limit up to and including the limit', () => {
    expect(state(9)).toEqual({kind: 'amber', margin: 0.1});
    expect(state(9.5)).toEqual({kind: 'amber', margin: 0.05});
    expect(state(10)).toEqual({kind: 'amber', margin: 0});
  });
  it('is ok just under 90 %', () => {
    expect(state(8.99).kind).toBe('ok');
  });
  it('is red over the limit, reporting how far over as a fraction of the limit', () => {
    expect(state(12)).toEqual({kind: 'red', over: 0.2});
    expect(state(10.0001).kind).toBe('red');
  });
  it('is none with no limit, no value or a value that is not a number', () => {
    expect(limitState(LimitKind.VB_MAX, 5, null)).toEqual({kind: 'none'});
    expect(state(null)).toEqual({kind: 'none'});
    expect(state(Number.NaN)).toEqual({kind: 'none'});
    expect(state(Infinity)).toEqual({kind: 'none'});
  });
});

describe('limitState, the at-least kind (vent diameter must stay at or over the limit)', () => {
  const limit = VentDiameterLimit_cm.of(10);
  const state = (value: number | null) => limitState(LimitKind.VENT_DIAMETER_MIN, value, limit);

  it('is ok well over the limit', () => {
    expect(state(20)).toEqual({kind: 'ok', margin: 1});
  });
  it('is amber from the limit up to 110 % of it', () => {
    expect(state(10)).toEqual({kind: 'amber', margin: 0});
    expect(state(11).kind).toBe('amber');
    expect(state(11.01).kind).toBe('ok');
  });
  it('is red under the limit', () => {
    expect(state(8)).toEqual({kind: 'red', over: 0.2});
  });
  it('is none with no value', () => {
    expect(state(null)).toEqual({kind: 'none'});
  });
});

describe('parseLimit', () => {
  it('turns text and numbers into a limit of the kind', () => {
    const parsed = parseLimit(LimitKind.F3_MAX, ' 35.5 ');
    expect(parsed).toEqual({kind: 'valid', limit: F3Limit_hz.of(35.5)});
    expect(parseLimit(LimitKind.VB_MAX, 12)).toEqual({kind: 'valid', limit: VolumeLimit_L.of(12)});
  });
  it('treats blank text as no limit, never 0', () => {
    expect(parseLimit(LimitKind.F3_MAX, '')).toEqual({kind: 'blank'});
    expect(parseLimit(LimitKind.F3_MAX, '   ')).toEqual({kind: 'blank'});
  });
  it('rejects zero, negatives, words and non-finite numbers', () => {
    for (const bad of ['0', '-3', 'abc', 0, -1, Number.NaN, Infinity]) {
      expect(parseLimit(LimitKind.F3_MAX, bad)).toEqual({kind: 'invalid'});
    }
  });
  it('each kind makes its own unit', () => {
    expect(LimitKind.VENT_SPEED_MAX.make(17)).toBeInstanceOf(VentSpeedLimit_m_per_s);
    expect(LimitKind.VENT_LENGTH_MAX.make(30)).toBeInstanceOf(VentLengthLimit_cm);
    expect(LimitKind.XMAX_MAX.make(7)).toBeInstanceOf(ExcursionLimit_mm);
  });
});

describe('LimitKind', () => {
  it('each kind reads its own number from a reading', () => {
    expect(LimitKind.F3_MAX.read(READING)).toBe(40);
    expect(LimitKind.VB_MAX.read(READING)).toBe(20);
    expect(LimitKind.VENT_SPEED_MAX.read(READING)).toBe(15);
    expect(LimitKind.VENT_LENGTH_MAX.read(READING)).toBe(30);
    expect(LimitKind.XMAX_MAX.read(READING)).toBe(5);
    expect(LimitKind.VENT_DIAMETER_MIN.read(READING)).toBe(8);
  });
  it('carries label, unit and direction', () => {
    expect(LimitKind.VENT_SPEED_MAX).toMatchObject({label: 'Vent speed', unit: 'm/s', direction: 'atMost'});
    expect(LimitKind.VENT_DIAMETER_MIN.direction).toBe('atLeast');
  });
});

describe('LimitState.match', () => {
  const words = {
    none: () => 'none', ok: (m: number) => `ok ${m}`, amber: (m: number) => `amber ${m}`, red: (o: number) => `red ${o}`,
  };
  it('runs the case for the state with its number', () => {
    const states: State[] = [{kind: 'none'}, {kind: 'ok', margin: 1}, {kind: 'amber', margin: 2}, {kind: 'red', over: 3}];
    expect(states.map(s => LimitState.match(s, words))).toEqual(['none', 'ok 1', 'amber 2', 'red 3']);
  });
});

describe('TuneStates', () => {
  it('is none for every kind while the limits are blank', () => {
    const states = new TuneStates(READING, TuneLimits.NONE);
    for (const s of [states.f3, states.vb, states.ventSpeed, states.ventLength, states.xmax, states.ventDiameter]) {
      expect(s).toEqual({kind: 'none'});
    }
  });
  it('gives each kind its own state', () => {
    const limits = new TuneLimits(
      F3Limit_hz.of(30), VolumeLimit_L.of(20), VentSpeedLimit_m_per_s.of(16), VentLengthLimit_cm.of(100),
      ExcursionLimit_mm.of(4), VentDiameterLimit_cm.of(8),
    );
    const states = new TuneStates(READING, limits);
    expect(states.f3.kind).toBe('red');
    expect(states.vb.kind).toBe('amber');
    expect(states.ventSpeed.kind).toBe('amber');
    expect(states.ventLength.kind).toBe('ok');
    expect(states.xmax.kind).toBe('red');
    expect(states.ventDiameter.kind).toBe('amber');
  });
});

describe('TuneText.stateWord', () => {
  it('has plain words for each state', () => {
    expect(TuneText.stateWord({kind: 'ok', margin: 1})).toBe('OK');
    expect(TuneText.stateWord({kind: 'amber', margin: 0.05})).toBe('Near limit');
    expect(TuneText.stateWord({kind: 'red', over: 0.2})).toBe('Over limit');
    expect(TuneText.stateWord({kind: 'none'})).toBe('No limit');
  });
});
