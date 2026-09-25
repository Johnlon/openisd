import {describe, expect, it} from 'vitest';
import type {PresentSolverField, SignalSolverParams} from '../../engine/index.js';
import {Engine} from '../../engine/index.js';
import {fakeSolverField} from './testSolver.js';

const engine = new Engine();

interface FakeVoltage extends PresentSolverField { readonly calculated: boolean }

/** A never-absent voltage handle: entered or calculated. */
function voltage(value: number, entered: boolean): FakeVoltage {
  let current = value;
  let isEntered = entered;
  return {
    get value() { return current; },
    get entered() { return isEntered; },
    get calculated() { return !isEntered; },
    setCalculated(v: number) { current = v; isEntered = false; },
  };
}

function params(power_W: number | null, Re_ohm: number | null, V: FakeVoltage): SignalSolverParams & { voltage_V: FakeVoltage } {
  return { power_W: fakeSolverField(power_W), Re_ohm: fakeSolverField(Re_ohm), voltage_V: V };
}

describe('Engine.solveSignal — power_W = voltage_V² / Re_ohm; the entered one fixes the other', () => {
  it('pre: Re 8, P 2 E, V 1 C | solve | post: P 2 E, V 4 C, no issue', () => {
    const p = params(2, 8, voltage(1, false));
    expect(engine.solveSignal(p)).toEqual([]);
    expect(p.voltage_V.value).toBeCloseTo(4, 12);
    expect(p.voltage_V.calculated).toBe(true);
    expect(p.power_W.entered).toBe(true);
  });

  it('pre: Re 8, P 1 E, V 4 E | solve | post: P 2 C, V 4 E, no issue', () => {
    const p = params(1, 8, voltage(4, true));
    expect(engine.solveSignal(p)).toEqual([]);
    expect(p.power_W.value).toBeCloseTo(2, 12);
    expect(p.power_W.calculated).toBe(true);
    expect(p.voltage_V.entered).toBe(true);
  });

  it('pre: Re none, P N, V 4 E | solve | post: P N with an issue naming Re, V 4 E', () => {
    const p = params(null, null, voltage(4, true));
    const issues = engine.solveSignal(p);
    expect(p.power_W.value).toBeNull();
    expect(p.voltage_V.value).toBe(4);
    expect(p.voltage_V.entered).toBe(true);
    expect(issues).toHaveLength(1);
    const issue = issues[0];
    expect(issue).toMatchObject({ kind: 'missing-dependencies', target: 'power_W' });
    if (issue.kind !== 'missing-dependencies') throw new Error('unreachable');
    expect(issue.routes.flatMap(r => r.missing)).toEqual(['Re_ohm']);
  });

  it('pre: Re none, P N, V 1 C | solve | post: P N, V 1 C untouched', () => {
    const p = params(null, null, voltage(1, false));
    engine.solveSignal(p);
    expect(p.voltage_V.value).toBe(1);
    expect(p.voltage_V.calculated).toBe(true);
  });

  it('pre: Re 8, P N, V 1 C | solve | post: P N with an issue naming voltage_V', () => {
    const p = params(null, 8, voltage(1, false));
    const issues = engine.solveSignal(p);
    expect(p.power_W.value).toBeNull();
    const issue = issues[0];
    if (issue?.kind !== 'missing-dependencies') throw new Error('unreachable');
    expect(issue.routes.flatMap(r => r.missing)).toEqual(['voltage_V']);
  });
});
