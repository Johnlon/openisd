/**
 * `sweepIssueMessage` — the seam between the engine's structured `SweepIssue`
 * (`CalculationIssue<Q>`-shaped) and the store's `DriverError`-shaped `allIssues` channel that
 * `GraphPanel-hooks.ts`/`series.ts` already render. Converting `sweep()`'s return type to the
 * unified issue shape (QO142) must not change what a user actually sees, so this pins the
 * projected text independently of the wider store wiring covered by `store-issue-channel.test.ts`.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {driverPrerequisiteMessage, sweepIssueMessage} from '../../src/logic/sweepIssueMessage.js';
import type {DriverPrerequisite, SweepIssue} from '@openisd/design/engine';

describe('sweepIssueMessage — SweepIssue projected to a DriverError for the existing UI channel', () => {
  it('a missing-dependencies issue names its target field and what would unblock it', () => {
    const issue: SweepIssue = {
      kind: 'missing-dependencies',
      target: 'Sd_m2',
      routes: [{ formula: 'Sd_m2 is a directly entered or derived driver quantity', required: ['Sd_m2'], missing: ['Sd_m2'] }],
    };
    const error = sweepIssueMessage(issue);
    assert.equal(error.level, 'error');
    assert.equal(error.field, 'Sd_m2');
    assert.match(error.message, /Sd_m2/);
  });

  it('an inconsistent-inputs issue names every field in the group and the disagreement', () => {
    const issue: SweepIssue = {
      kind: 'inconsistent-inputs',
      target: 'Qts',
      fields: ['Qts', 'Qes', 'Qms'],
      formula: 'Qts = Qes·Qms/(Qes+Qms)',
      expected: 0.38,
      actual: 0.50,
      relative: 0.32,
    };
    const error = sweepIssueMessage(issue);
    assert.equal(error.level, 'error');
    assert.match(error.message, /Qts/);
    assert.match(error.message, /Qes/);
    assert.match(error.message, /Qms/);
    assert.match(error.message, /32/);
  });
});

describe('driverPrerequisiteMessage — DriverPrerequisite projected to a non-blocking DriverError', () => {
  it('names the output and what would bound it, at warn level — not a blocking error (QO143)', () => {
    const prereq: DriverPrerequisite = { output: 'maxspl', missing: ['Pe_W', 'Xmax_m'] };
    const error = driverPrerequisiteMessage(prereq);
    assert.equal(error.level, 'warn');
    assert.equal(error.field, 'maxspl');
    assert.match(error.message, /Pe_W/);
    assert.match(error.message, /Xmax_m/);
  });
});
