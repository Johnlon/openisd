/**
 * The driver consistency solver, pinned as it stands. A fixed grid of stated quantities goes
 * through `engine.driver.solveValues` (every block alone, routes that compete for one output,
 * leave-one-out and leave-two-out of a consistent record, inconsistent records, other air, a
 * radiator's seven figures) and the record cases also through `OpenISDDriver.resolve()`. The
 * expected outputs were captured before the solver was split into relations
 * (bugs/archive/BUG_20261003_driver-consistency-solver-is-one-925-line-function.md). Any change to a route
 * order, a precedence, a formula or a conflict report fails here, by name.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../domain/index.js';
import {SOLVER_CASES} from '../fixtures/driverSolverCases.js';
import {DRIVER_SOLVER_GOLDEN} from '../fixtures/driverSolverGolden.js';
import {runCase} from '../fixtures/driverSolverRun.js';
import type {CaseOutcome, IssueOutcome} from '../fixtures/driverSolverRun.js';

const FLOAT_TOLERANCE = 1e-15;

/** Equal to a relative 1e-15: last-digit float difference only. */
function expectClose(actual: number, expected: number, what: string): void {
  const scale = Math.max(Math.abs(actual), Math.abs(expected));
  expect(Math.abs(actual - expected) <= FLOAT_TOLERANCE * scale, `${what}: ${actual} vs ${expected}`).toBe(true);
}

function expectCloseOptional(actual: number | undefined, expected: number | undefined, what: string): void {
  if (expected === undefined || actual === undefined) {
    expect(actual, what).toBe(expected);
    return;
  }
  expectClose(actual, expected, what);
}

function expectIssues(actual: readonly IssueOutcome[], expected: readonly IssueOutcome[], name: string): void {
  expect(actual.map(i => `${i.kind} ${i.fields.join(',')}`), `${name}: issues`)
    .toEqual(expected.map(i => `${i.kind} ${i.fields.join(',')}`));
  actual.forEach((issue, k) => {
    const want = expected[k]!;
    expect(issue.text, `${name}: issue ${k} text`).toBe(want.text);
    expectCloseOptional(issue.expected, want.expected, `${name}: issue ${k} expected`);
    expectCloseOptional(issue.actual, want.actual, `${name}: issue ${k} actual`);
    expectCloseOptional(issue.relative, want.relative, `${name}: issue ${k} relative`);
  });
}

function expectOutcome(actual: CaseOutcome, expected: CaseOutcome): void {
  expect(actual.values.map(v => v.field), `${actual.name}: which quantities were solved`)
    .toEqual(expected.values.map(v => v.field));
  actual.values.forEach((v, k) => expectClose(v.value, expected.values[k]!.value, `${actual.name}: ${v.field}`));

  expect(actual.record === undefined, `${actual.name}: record cases`).toBe(expected.record === undefined);
  if (actual.record !== undefined && expected.record !== undefined) {
    actual.record.forEach((field, k) => {
      const want = expected.record![k]!;
      expect(field.entered, `${actual.name}: ${field.field} entered`).toBe(want.entered);
      expect(field.value === null, `${actual.name}: ${field.field} present`).toBe(want.value === null);
      if (field.value !== null && want.value !== null) expectClose(field.value, want.value, `${actual.name}: ${field.field}`);
    });
  }
  if (actual.issues !== undefined && expected.issues !== undefined) {
    expectIssues(actual.issues, expected.issues, actual.name);
  }
}

describe('driver consistency solver — characterization', () => {
  const engine = createEngine();

  it('the golden holds exactly the cases, in order, none twice', () => {
    expect(DRIVER_SOLVER_GOLDEN.map(c => c.name)).toEqual(SOLVER_CASES.map(c => c.name));
    expect(new Set(SOLVER_CASES.map(c => c.name)).size).toBe(SOLVER_CASES.length);
  });

  it('a run is deterministic: the same case twice gives the same answer', () => {
    for (const testCase of SOLVER_CASES.filter((_, index) => index % 8 === 0)) {
      expect(runCase(engine, testCase), testCase.name).toEqual(runCase(engine, testCase));
    }
  });

  for (const [index, testCase] of SOLVER_CASES.entries()) {
    it(testCase.name, () => {
      expectOutcome(runCase(engine, testCase), DRIVER_SOLVER_GOLDEN[index]!);
    });
  }
});
