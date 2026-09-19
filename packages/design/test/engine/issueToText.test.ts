import {describe, expect, it} from 'vitest';
import {Engine} from '../../engine/index.js';
import {checkConsistency} from './testSolver.js';

const engine = new Engine();

describe('Engine.issueToText — one sentence per issue, everywhere', () => {
  it('renders a missing-dependencies issue as "<target> cannot be calculated yet — state <routes>."', () => {
    const issues = checkConsistency({ Qes: 0.4 });
    expect(issues).toHaveLength(1);
    const issue = issues[0];
    expect(issue.kind).toBe('missing-dependencies');
    expect(engine.issueToText(issue)).toBe(
      'Qts cannot be calculated yet — state Qts = Qes·Qms/(Qes+Qms) (needs Qms).',
    );
  });

  it('renders an inconsistent-inputs issue as "<fields> disagree by <pct>: <formula>. Every field..."', () => {
    const issues = checkConsistency({ Qts: 7.5, Qes: 0.4, Qms: 3.0 });
    expect(issues).toHaveLength(1);
    const issue = issues[0];
    expect(issue.kind).toBe('inconsistent-inputs');
    expect(engine.issueToText(issue)).toBe(
      'Qts, Qes, Qms disagree by 95.3%: Qts = Qes·Qms/(Qes+Qms). Every field in the group is marked '
      + '— correct one of them, or clear one to let it be calculated.',
    );
  });
});
