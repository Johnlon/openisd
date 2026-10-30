/** projectAir: the air fields over an environment record and the resolve that writes them back. */
import {describe, expect, it, vi} from 'vitest';
import {createEngine} from '../../../engine/Engine.js';
import type {AirIssue} from '../../../engine/index.js';
import {simpleField} from '../../../domain/cell.js';
import type {OpenISDEnvironmentJson} from '../../../domain/openisdSchema.js';
import {airFieldsOver, airStateOf, resolveAir} from '../../../domain/project/projectAir.js';

function over(initial: OpenISDEnvironmentJson = {}, issues: readonly AirIssue[] = []) {
  let record = initial;
  const environment = simpleField(() => record, v => { record = v; });
  return {fields: airFieldsOver(environment, () => issues), record: () => record};
}

const conflict: AirIssue = {
  kind: 'inconsistent-inputs', target: 'rho', fields: ['tempK', 'pressurePa', 'rho'],
  formula: 'f', expected: 1, actual: 2, relative: 1, text: 'conflict',
};

describe('airStateOf', () => {
  it('is available once c and rho both hold a value', () => {
    const {fields} = over({c_m_per_s: {state: 'E', value: 343}, roo_kg_per_m3: {state: 'E', value: 1.2}});
    const state = airStateOf(fields, []);
    expect(state.kind).toBe('available');
  });

  it('is not available when c or rho is empty, carrying the issues of both', () => {
    const {fields} = over({c_m_per_s: {state: 'E', value: 343}});
    const rhoIssue: AirIssue = {...conflict, target: 'rho', fields: ['rho']};
    const cIssue: AirIssue = {...conflict, target: 'c', fields: ['c']};
    const other: AirIssue = {...conflict, target: 'tempK', fields: ['tempK']};
    expect(airStateOf(fields, [other, rhoIssue, cIssue])).toEqual({kind: 'notAvailable', issues: [cIssue, rhoIssue]});
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
      values: {tempK: 300, humidityPct: null, pressurePa: null, c: null, rho: null},
      widths: {tempK: 0.5, humidityPct: null, pressurePa: null, c: null, rho: null},
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

  it('writes solved values as calculated with their width, empties what nothing gives, and marks conflicts', () => {
    const engine = createEngine();
    vi.spyOn(engine.environment, 'solveAir').mockReturnValue({
      values: {tempK: null, humidityPct: 30, pressurePa: 101325, c: 343, rho: 1.2},
      widths: {tempK: null, humidityPct: 0, pressurePa: 2, c: null, rho: 0.1},
      issues: [conflict],
    });
    const {fields, record} = over({temperature_K: {state: 'C', value: 290}});
    const result = resolveAir(fields, engine.environment);
    expect(fields.tempK.value).toBeNull();
    expect(record().temperature_K).toBeUndefined();
    expect(record().humidity_pct).toMatchObject({state: 'C', value: 30});
    expect(JSON.stringify(record().humidity_pct)).not.toContain('precision');
    expect(record().pressure_Pa).toMatchObject({state: 'C', value: 101325, precision: 2});
    expect(record().c_m_per_s).toMatchObject({state: 'C', value: 343});
    expect(record().roo_kg_per_m3).toMatchObject({state: 'C', value: 1.2, precision: 0.1});
    expect(result.issues).toEqual([conflict]);
    expect(result.state.kind).toBe('available');
    const marked = record().pressure_Pa;
    expect(marked?.state === 'C' ? marked.dq_calculated?.length : -1).toBe(1);
  });

  it('leaves an entered quantity as typed and reports not available when no c or rho comes out', () => {
    const engine = createEngine();
    vi.spyOn(engine.environment, 'solveAir').mockReturnValue({
      values: {tempK: 999, humidityPct: null, pressurePa: null, c: null, rho: null},
      widths: {tempK: null, humidityPct: null, pressurePa: null, c: null, rho: null},
      issues: [],
    });
    const {fields} = over();
    fields.tempK.set(300);
    const result = resolveAir(fields, engine.environment);
    expect(fields.tempK.value).toBe(300);
    expect(result.state).toEqual({kind: 'notAvailable', issues: []});
  });

  it('clears an earlier mark when the new resolve has none', () => {
    const engine = createEngine();
    vi.spyOn(engine.environment, 'solveAir').mockReturnValue({
      values: {tempK: 300, humidityPct: null, pressurePa: null, c: null, rho: null},
      widths: {tempK: 0, humidityPct: null, pressurePa: null, c: null, rho: null},
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
