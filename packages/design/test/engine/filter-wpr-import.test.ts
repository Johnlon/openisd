/**
 * `FilterEngine.wpr` / `fromWpr` — the `.wpr` `[Filters]` shape of every filter type, disabled
 * filters, and the malformed-params paths (wrong field count, non-numeric field) that load as
 * the type's default; plus the raised-cosine response with a non-positive fc / bandwidth.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import type {Filter, FilterType} from '../../engine/types.js';
import {sweepDriver, solveConsistencyGroup} from './testSolver.js';
import {REFERENCE_AIR} from '../fixtures/referenceAir.js';

const engine = createEngine();

describe('FilterEngine.wpr — a disabled filter writes enabled bit 0', () => {
  // Lowpass/highpass lead with WinISD's Filter Editor subtype code: 0 Butterworth, 1 Linkwitz-Riley,
  // 2 Bessel, 3 User SOS.
  const cases: ReadonlyArray<[Filter, string]> = [
    [{type: 'lowpass', enabled: false, family: 'butterworth', order: 2, fc: 50, Q: 0.707}, '0;0;2;50;0.707'],
    [{type: 'lowpass', enabled: false, family: 'linkwitzRiley', order: 4, fc: 80, Q: 0.707}, '1;0;4;80;0.707'],
    [{type: 'highpass', enabled: false, family: 'bessel', order: 2, fc: 20, Q: 0.707}, '2;0;2;20;0.707'],
    [{type: 'highpass', enabled: false, family: 'sos', order: 2, fc: 25, Q: 0.5}, '3;0;2;25;0.5'],
    [{type: 'allpass', enabled: false, order: 1, t: 0.001, Q: 0.707}, '0;0;1;0.001;0.707'],
    [{type: 'linkwitz', enabled: false, f0: 50, Q0: 0.7, fp: 20, Qp: 0.5}, '0;0;50;0.7;20;0.5'],
    [{type: 'peaking', enabled: false, fc: 30, Q: 2, gain: 6}, '0;0;30;2;6'],
    [{type: 'peakHighpass', enabled: false, fpk: 20, gainPk: 6}, '0;0;20;6'],
    [{type: 'staticGain', enabled: false, gain: 3}, '0;0;3'],
    [{type: 'raisedCosine', enabled: false, fc: 100, bwOct: 0.333, gain: 6}, '0;0;100;0.333;6'],
  ];
  for (const [filter, params] of cases) {
    it(`${filter.type} ${params}`, () => {
      expect(engine.filters.wpr(filter)?.params).toBe(params);
      expect(engine.filters.wpr({...filter, enabled: true})?.params).toBe(params.replace(';0;', ';1;'));
    });
  }
});

describe('FilterEngine.fromWpr — malformed params load as the type default', () => {
  // [WinISD type number, FilterType, a params line with the wrong field count, one with a non-numeric field]
  const cases: ReadonlyArray<[number, FilterType, string[], string[]]> = [
    [0, 'lowpass', ['0', '1', '2', '50'], ['0', '1', '2', 'x', '0.7']],
    [1, 'highpass', ['0', '1', '2', '50'], ['0', '1', 'x', '20', '0.7']],
    [2, 'allpass', ['0', '1', '1', '0.001'], ['0', '1', '1', 'x', '0.7']],
    [3, 'linkwitz', ['0', '1', '50', '0.7', '20'], ['0', '1', '50', '0.7', 'x', '0.5']],
    [4, 'peaking', ['0', '1', '30', '2'], ['0', '1', '30', '2', 'x']],
    [5, 'peakHighpass', ['0', '1', '20'], ['0', '1', 'x', '6']],
    [6, 'staticGain', ['0', '1'], ['0', '1', 'x']],
    [7, 'raisedCosine', ['0', '1', '100', '0.3'], ['0', '1', '100', 'x', '6']],
  ];
  for (const [typeNum, type, shortFields, nanFields] of cases) {
    it(`${type}: wrong field count and non-numeric field`, () => {
      for (const fields of [shortFields, nanFields]) {
        const result = engine.filters.fromWpr(typeNum, fields);
        expect(result.filter).toEqual(engine.filters.default(type));
        expect(result.warning).toBe(`${type} params malformed — WinISD loads it as its default ${type}`);
      }
    });
  }

  it('a lowpass subtype that is not a whole measured code (negative) is malformed', () => {
    const result = engine.filters.fromWpr(0, ['-1', '1', '2', '50', '0.7']);
    expect(result.filter).toEqual(engine.filters.default('lowpass'));
    expect(result.warning).toBe('lowpass params malformed — WinISD loads it as its default lowpass');
  });

  it('a non-numeric enabled field keeps the default enabled bit (true)', () => {
    const result = engine.filters.fromWpr(6, ['0', 'x', '3']);
    expect(result.filter).toEqual({type: 'staticGain', enabled: true, gain: 3});
    expect(result.warning).toBeNull();
  });

  it('an enabled field of 0 loads disabled', () => {
    expect(engine.filters.fromWpr(6, ['0', '0', '3']).filter).toEqual({type: 'staticGain', enabled: false, gain: 3});
  });
});

describe('RaisedCosineFilterModel response — a non-positive fc or bandwidth is replaced by 1e-6', () => {
  const DRV = sweepDriver(solveConsistencyGroup({
    Fs_hz: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas_m3: 0.0300,
    Sd_m2: 0.0133, Re_ohm: 5.6, Le_H: 0.7e-3, Xmax_m: 0.0050, Pe_W: 60, Znom_ohm: 8,
  }));
  const magAt = (filter: Filter, f: number): number => engine.simulation.sweep(DRV, 0.7e-3, 'sealed',
    {Vb: 0.030, eg: 2.83, fmin: f, fmax: f, N: 0, filters: [filter], air: REFERENCE_AIR}).values!.fltMag[0]!;

  it('fc 0 puts every audible frequency far above the band: unity', () => {
    expect(magAt({type: 'raisedCosine', enabled: true, fc: 0, bwOct: 0.333, gain: 6}, 100)).toBe(0);
  });
  it('bandwidth 0 makes the band vanishingly narrow: unity off fc', () => {
    expect(magAt({type: 'raisedCosine', enabled: true, fc: 100, bwOct: 0, gain: 6}, 120)).toBe(0);
  });
  it('a normal raised cosine at fc gives its full gain', () => {
    expect(magAt({type: 'raisedCosine', enabled: true, fc: 100, bwOct: 1, gain: 6}, 100)).toBeCloseTo(6, 10);
  });
});
