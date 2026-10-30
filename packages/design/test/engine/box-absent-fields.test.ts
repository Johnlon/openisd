/**
 * Box circuits with an absent box-specific field — each `SweepParams` field a topology reads
 * (`Fr`, `Ff`, `Vf`, `Sp`, `Qlr`, …) is optional, and an absent one poisons the sweep with NaN so
 * `classifyFinite` reports it, never a throw. Also the `||` defaults (`Qp`, `prNum`, `prRms`) and
 * the transmission-line port paths of the vented / bandpass / ABC `winisd-lossy` forms.
 * Reached only through `Engine.simulation.sweep`, the engine's one door.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import type {SimulatableBoxType, SweepParams} from '../../engine/types.js';
import {sweepDriver, solveConsistencyGroup} from './testSolver.js';
import {REFERENCE_AIR} from '../fixtures/referenceAir.js';

const engine = createEngine();
const LE_H = 0.7e-3;
const DRV = sweepDriver(solveConsistencyGroup({
  Fs_hz: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas_m3: 0.0300,
  Sd_m2: 0.0133, Re_ohm: 5.6, Xmax_m: 0.0050, Pe_W: 60, Znom_ohm: 8,
}));

const BASE: SweepParams = {Vb: 0.030, eg: 2.83, fmin: 30, fmax: 300, N: 5, air: REFERENCE_AIR};
const LOSSLESS: SweepParams = {...BASE, Ql: 1e6, Qa: 1e6};
const LOSSY: SweepParams = {...BASE, Ql: 10, Qa: 100};
const CHAMBERS: Partial<SweepParams> = {
  Vf: 0.020, Fr: 45, Ff: 60, Sp: 0.002, Spr: 0.002, SpIntra: 0.0013, LeffIntra: 0.05,
  portEndCorrection_m: 0.01, rearPortEndCorrection_m: 0.01,
};
const CHAMBER_QS: Partial<SweepParams> = {Qlr: 10, Qar: 100, Qpr: 100, Qlf: 10, Qaf: 100, Qpf: 100, Qiclfr: 10};

type Omittable = keyof SweepParams;

function values(box: SimulatableBoxType, P: SweepParams) {
  return engine.simulation.sweep(DRV, LE_H, box, P).values!;
}
function isFinite(box: SimulatableBoxType, P: SweepParams): boolean {
  return engine.simulation.classifyFinite(values(box, P)) === null;
}
function without(P: SweepParams, field: Omittable): SweepParams {
  const copy: SweepParams = {...P};
  delete copy[field];
  return copy;
}

describe('a box with every field present sweeps finite', () => {
  const cases: ReadonlyArray<[string, SimulatableBoxType, SweepParams]> = [
    ['abc lossless', 'abc', {...LOSSLESS, ...CHAMBERS}],
    ['abc lossy', 'abc', {...LOSSY, ...CHAMBERS, ...CHAMBER_QS}],
    ['bandpass4 lossless', 'bandpass4', {...LOSSLESS, ...CHAMBERS, Leff: 0.1}],
    ['bandpass4 lossy', 'bandpass4', {...LOSSY, ...CHAMBERS, ...CHAMBER_QS}],
    ['bandpass6 lossless', 'bandpass6', {...LOSSLESS, ...CHAMBERS}],
    ['bandpass6 lossy', 'bandpass6', {...LOSSY, ...CHAMBERS, ...CHAMBER_QS}],
  ];
  for (const [name, box, P] of cases) it(name, () => expect(isFinite(box, P)).toBe(true));
});

describe('an absent chamber field poisons the sweep with NaN', () => {
  const cases: ReadonlyArray<[string, SimulatableBoxType, SweepParams, Omittable[]]> = [
    ['abc lossless', 'abc', {...LOSSLESS, ...CHAMBERS}, ['Fr', 'Vf', 'Ff', 'LeffIntra', 'SpIntra']],
    ['abc lossy', 'abc', {...LOSSY, ...CHAMBERS, ...CHAMBER_QS},
      ['Vf', 'Qlr', 'Qar', 'Qpr', 'Qlf', 'Qaf', 'Qpf', 'Qiclfr', 'Fr', 'Ff', 'LeffIntra', 'SpIntra']],
    ['bandpass4 lossless', 'bandpass4', {...LOSSLESS, ...CHAMBERS, Leff: 0.1}, ['Vf']],
    ['bandpass4 lossy', 'bandpass4', {...LOSSY, ...CHAMBERS, ...CHAMBER_QS},
      ['Vf', 'Qlr', 'Qar', 'Qiclfr', 'Qlf', 'Qaf', 'Qpf', 'Ff']],
    ['bandpass6 lossless', 'bandpass6', {...LOSSLESS, ...CHAMBERS}, ['Fr', 'Vf', 'Ff']],
    ['bandpass6 lossy', 'bandpass6', {...LOSSY, ...CHAMBERS, ...CHAMBER_QS},
      ['Vf', 'Qlr', 'Qar', 'Qpr', 'Qlf', 'Qaf', 'Qpf', 'Qiclfr', 'Fr', 'Ff']],
  ];
  for (const [name, box, P, fields] of cases) {
    for (const field of fields) {
      it(`${name}: no ${field}`, () => expect(isFinite(box, without(P, field))).toBe(false));
    }
  }
});

describe('a zero Qp falls back to 100 in the lossless chamber boxes', () => {
  for (const box of ['abc', 'bandpass6'] as const) {
    it(box, () => {
      const P = {...LOSSLESS, ...CHAMBERS};
      expect(values(box, {...P, Qp: 0}).spl).toEqual(values(box, {...P, Qp: 100}).spl);
    });
  }
});

describe('the transmission-line port of the winisd-lossy chamber boxes', () => {
  const TL: Partial<SweepParams> = {tlPortModel: true, winisdTlPortNoEndCorrection: true};
  for (const box of ['abc', 'bandpass4', 'bandpass6'] as const) {
    const P: SweepParams = {...LOSSY, ...CHAMBERS, ...CHAMBER_QS};
    it(`${box}: differs from the lumped port, finite`, () => {
      const tl = {...P, ...TL};
      expect(isFinite(box, tl)).toBe(true);
      expect(values(box, tl).spl).not.toEqual(values(box, P).spl);
    });
    it(`${box}: keeping the end correction (switch off) changes the line length`, () => {
      const tl = {...P, tlPortModel: true};
      expect(values(box, tl).spl).not.toEqual(values(box, {...tl, winisdTlPortNoEndCorrection: true}).spl);
    });
    it(`${box}: no front port area poisons the line`, () => {
      expect(isFinite(box, without({...P, ...TL}, 'Sp'))).toBe(false);
    });
    it(`${box}: no end correction while the switch is on poisons the line`, () => {
      expect(isFinite(box, without({...P, ...TL}, 'portEndCorrection_m'))).toBe(false);
    });
  }
  for (const box of ['abc', 'bandpass6'] as const) {
    it(`${box}: no rear port area poisons the line`, () => {
      const P: SweepParams = {...LOSSY, ...CHAMBERS, ...CHAMBER_QS, ...TL};
      expect(isFinite(box, without(P, 'Spr'))).toBe(false);
      expect(isFinite(box, without(P, 'rearPortEndCorrection_m'))).toBe(false);
    });
  }
});

describe('portImpedance via bandpass4 lossless', () => {
  it('a transmission-line port (zero Qp falls back to 100) sweeps finite', () => {
    const P: SweepParams = {...LOSSLESS, ...CHAMBERS, Leff: 0.1, tlPortModel: true, Qp: 0};
    expect(values('bandpass4', P).spl).toEqual(values('bandpass4', {...P, Qp: 100}).spl);
  });
});

describe('PassiveRadiatorBox', () => {
  const PR: SweepParams = {...LOSSLESS, prSd: 0.0133, prMmd: 0.030, prMadd: 0, prCms: 0.0008};
  it('prNum absent or 0 is one radiator; prRms absent is no radiator loss', () => {
    const one = values('box-passive-radiator', {...PR, prNum: 1, prRms: 0});
    expect(values('box-passive-radiator', PR).spl).toEqual(one.spl);
    expect(values('box-passive-radiator', {...PR, prNum: 0}).spl).toEqual(one.spl);
  });
  it('two radiators differ from one, and WinISD\'s Npr resonance changes the winisd-lossy tuning', () => {
    const lossy: SweepParams = {...PR, Ql: 10, Qa: 100, prNum: 2};
    expect(values('box-passive-radiator', {...PR, prNum: 2}).spl).not.toEqual(values('box-passive-radiator', PR).spl);
    expect(values('box-passive-radiator', {...lossy, winisdPrNprResonance: true}).spl)
      .not.toEqual(values('box-passive-radiator', {...lossy, winisdPrNprResonance: false}).spl);
  });
  for (const field of ['prMmd', 'prMadd', 'prSd', 'prCms'] as const) {
    it(`no ${field} poisons the sweep`, () => {
      expect(isFinite('box-passive-radiator', without(PR, field))).toBe(false);
    });
  }
});

describe('VentedBox winisd-lossy', () => {
  it('an absent Fb poisons the sweep with NaN', () => {
    expect(isFinite('vented', {...LOSSY, Sp: 0.002})).toBe(false);
  });
  it('a zero Qp falls back to 100', () => {
    const V: SweepParams = {...LOSSY, Fb: 40};
    expect(values('vented', {...V, Qp: 0}).spl).toEqual(values('vented', {...V, Qp: 100}).spl);
  });
});

describe('VentedBox winisd-lossy transmission line', () => {
  const V: SweepParams = {...LOSSY, Fb: 40, Sp: 0.002, tlPortModel: true, winisdTlPortNoEndCorrection: true, portEndCorrection_m: 0.01};
  it('finite with a port area, NaN without', () => {
    expect(isFinite('vented', V)).toBe(true);
    expect(isFinite('vented', without(V, 'Sp'))).toBe(false);
  });
});

describe('AbcBox winisd-lossy intra-port velocity', () => {
  const P: SweepParams = {...LOSSY, ...CHAMBERS, ...CHAMBER_QS};
  it('switching winisdAbcIntraPortVelocity off keeps the leak term, so the intra-port velocity differs', () => {
    const on = values('abc', {...P, winisdAbcIntraPortVelocity: true});
    const off = values('abc', {...P, winisdAbcIntraPortVelocity: false});
    expect(off.spl).toEqual(on.spl);
    expect(off.pvIntra).not.toEqual(on.pvIntra);
  });
});
