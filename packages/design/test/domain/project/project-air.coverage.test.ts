/** projectAir: the air fields over an environment record and the resolve that writes them back. */
import {describe, expect, it, vi} from 'vitest';
import {createEngine} from '../../../engine/Engine.js';
import type {AirIssue} from '../../../engine/index.js';
import {simpleField} from '../../../domain/cell.js';
import type {OpenISDEnvironmentJson} from '../../../domain/openisdSchema.js';
import {airFieldsOver, airOf, resolveAir} from '../../../domain/project/projectAir.js';

function over(initial: OpenISDEnvironmentJson = {}, issues: readonly AirIssue[] = []) {
  let record = initial;
  const environment = simpleField(() => record, v => { record = v; });
  return {fields: airFieldsOver(environment, () => issues), record: () => record};
}

const conflict: AirIssue = {
  kind: 'inconsistent-inputs', target: 'rho', fields: ['tempK', 'pressurePa', 'rho'],
  formula: 'f', expected: 1, actual: 2, relative: 1, text: 'conflict',
};

describe('airOf', () => {
  it('is the c and rho the fields hold', () => {
    const {fields} = over({c_m_per_s: {state: 'E', value: 343}, roo_kg_per_m3: {state: 'E', value: 1.2}});
    const air = airOf(fields, createEngine().environment);
    expect([air.c(), air.rho()]).toEqual([343, 1.2]);
  });

  it('is calculated from the three conditions for a field that holds nothing', () => {
    const engine = createEngine();
    const {fields} = over({c_m_per_s: {state: 'E', value: 343}});
    const app = engine.environment.appAir;
    const wanted = engine.environment.solve({tempK: app.temperature(), humidityPct: app.humidity(), pressurePa: app.pressure()}).values;
    const air = airOf(fields, engine.environment);
    expect(air.c()).toBe(343);
    expect(air.rho()).toBeGreaterThan(0);
    expect(wanted.c).toBeGreaterThan(0);
  });
});

describe('airFieldsOver', () => {
  it('marks a field with the issues aimed at it and the conflicts that name it', () => {
    const {fields} = over({temperature_K: {state: 'E', value: 300}, humidity_pct: {state: 'E', value: 40}}, [conflict]);
    expect(fields.tempK.dq.length).toBe(1);
    expect(fields.humidityPct.dq.length).toBe(0);
  });
});

describe('resolveAir', () => {
  it('feeds entered quantities to the solver with their precision, and open ones as open', () => {
    const engine = createEngine();
    const solve = vi.spyOn(engine.environment, 'solveAir').mockReturnValue({
      values: {tempK: 300, humidityPct: 30, pressurePa: 101325, c: 343, rho: 1.2},
      widths: {tempK: 0.5, humidityPct: 0, pressurePa: 0.5, c: 0, rho: 0},
      issues: [],
    });
    const {fields} = over();
    fields.tempK.set(300, 0.5);
    fields.pressurePa.set(101325);
    resolveAir(fields, engine.environment);
    expect(solve).toHaveBeenCalledWith({
      tempK: {kind: 'entered', value: 300, precision: 0.5},
      humidityPct: {kind: 'open'},
      pressurePa: {kind: 'entered', value: 101325, precision: 0.5},
      c: {kind: 'open'},
      rho: {kind: 'open'},
    });
  });

  it('writes solved values as calculated with their width and marks conflicts', () => {
    const engine = createEngine();
    vi.spyOn(engine.environment, 'solveAir').mockReturnValue({
      values: {tempK: 290, humidityPct: 30, pressurePa: 101325, c: 343, rho: 1.2},
      widths: {tempK: 0, humidityPct: 0, pressurePa: 2, c: 0, rho: 0.1},
      issues: [conflict],
    });
    const {fields, record} = over({temperature_K: {state: 'C', value: 290}});
    const result = resolveAir(fields, engine.environment);
    expect(record().temperature_K).toMatchObject({state: 'C', value: 290});
    expect(record().humidity_pct).toMatchObject({state: 'C', value: 30});
    expect(JSON.stringify(record().humidity_pct)).not.toContain('precision');
    expect(record().pressure_Pa).toMatchObject({state: 'C', value: 101325, precision: 2});
    expect(record().c_m_per_s).toMatchObject({state: 'C', value: 343});
    expect(record().roo_kg_per_m3).toMatchObject({state: 'C', value: 1.2, precision: 0.1});
    expect(result.issues).toEqual([conflict]);
    expect(result.air.c()).toBe(343);
    const marked = record().pressure_Pa;
    expect(marked?.state === 'C' ? marked.dq_calculated?.length : -1).toBe(1);
  });

  it('leaves an entered quantity as typed and fills every other one: p, RH, T from the app, c and rho from them', () => {
    const engine = createEngine();
    const {fields} = over();
    fields.tempK.set(300);
    const result = resolveAir(fields, engine.environment);
    const app = engine.environment.appAir;
    expect(fields.tempK.value).toBe(300);
    expect(fields.humidityPct.value).toBe(app.humidity());
    expect(fields.pressurePa.value).toBe(app.pressure());
    const fromThree = engine.environment.solve({tempK: 300, humidityPct: app.humidity(), pressurePa: app.pressure()}).values;
    expect(result.air.c()).toBe(fromThree.c);
    expect(result.air.rho()).toBe(fromThree.rho);
    expect(fields.c.value).toBe(fromThree.c);
  });

  it('clears an earlier mark when the new resolve has none', () => {
    const engine = createEngine();
    vi.spyOn(engine.environment, 'solveAir').mockReturnValue({
      values: {tempK: 300, humidityPct: 30, pressurePa: 101325, c: 343, rho: 1.2},
      widths: {tempK: 0, humidityPct: 0, pressurePa: 0, c: 0, rho: 0},
      issues: [],
    });
    const {fields} = over({}, [conflict]);
    fields.tempK.set(300);
    expect(fields.tempK.dq.length).toBe(1);
    const setDq = vi.spyOn(fields.tempK, 'setDq');
    resolveAir(fields, engine.environment);
    expect(setDq).toHaveBeenCalledWith([]);
  });
});
