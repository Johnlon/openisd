/**
 * Runs one `SolverCase` through the engine's driver area the way the app does, and reduces the
 * answer to plain data a golden can hold. Shared by `driver-solver-characterization.test.ts` and
 * the one-off generator that produced `driverSolverGolden.ts`.
 */
import type {Engine} from '../../domain/index.js';
import {driverFromSpec} from './recordBuilders.js';
import {RECORD_FIELDS, SOLVED_FIELDS} from './driverSolverCases.js';
import type {RecordField, SolvedField, SolverCase} from './driverSolverCases.js';

export interface ValueOutcome {
  readonly field: SolvedField;
  readonly value: number;
}

export interface RecordFieldOutcome {
  readonly field: RecordField;
  readonly value: number | null;
  readonly entered: boolean;
}

/** One issue, reduced to its kind, the fields it names and what it states. Numbers are absent where
 *  the kind carries none. */
export interface IssueOutcome {
  readonly kind: 'missing-dependencies' | 'inconsistent-inputs' | 'out-of-range';
  readonly fields: readonly string[];
  readonly text: string;
  readonly expected?: number;
  readonly actual?: number;
  readonly relative?: number;
}

export interface CaseOutcome {
  readonly name: string;
  /** Every quantity `solveValues` returned, in `SOLVED_FIELDS` order; an absent one is not listed. */
  readonly values: readonly ValueOutcome[];
  /** Present when the case carries a record: each record field after `driver.resolve()`. */
  readonly record?: readonly RecordFieldOutcome[];
  readonly issues?: readonly IssueOutcome[];
}

type DriverIssue = ReturnType<ReturnType<typeof driverFromSpec>['issues']>[number];

function outcomeOfIssue(issue: DriverIssue): IssueOutcome {
  switch (issue.kind) {
    case 'missing-dependencies':
      return {kind: issue.kind, fields: issue.fields, text: issue.text};
    case 'inconsistent-inputs':
      return {
        kind: issue.kind, fields: issue.fields, text: issue.text,
        expected: issue.expected, actual: issue.actual, relative: issue.relative,
      };
    case 'out-of-range':
      return {kind: issue.kind, fields: [issue.field], text: issue.text, actual: issue.value};
  }
}

export function runCase(engine: Engine, testCase: SolverCase): CaseOutcome {
  const solved = engine.driver.solveValues(testCase.stated);
  const values: ValueOutcome[] = [];
  for (const field of SOLVED_FIELDS) {
    const value = solved[field];
    if (typeof value === 'number') values.push({field, value});
  }
  if (testCase.record === undefined) return {name: testCase.name, values};

  const driver = driverFromSpec(engine, testCase.record);
  const issues = driver.resolve().map(outcomeOfIssue);
  const record = RECORD_FIELDS.map((field): RecordFieldOutcome => {
    const handle = driver.specField(field);
    return {field, value: handle.value, entered: handle.entered};
  });
  return {name: testCase.name, values, record, issues};
}
