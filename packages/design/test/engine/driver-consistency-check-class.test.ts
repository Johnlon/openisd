import {describe, expect, it, vi} from 'vitest';
import {ConsistencyCheck} from '../../engine/driver/routes/ConsistencyCheck.js';
import {Relation} from '../../engine/driver/routes/Relation.js';
import type {RelationValues} from '../../engine/driver/routes/Relation.js';

describe('ConsistencyCheck.check', () => {
  it('ignores a nudge of one field that makes the relation unpredictable, and still reports the gap', () => {
    const predict = vi.fn((v: RelationValues) => (v.Qes === 1 ? 5 : NaN));
    const check = new ConsistencyCheck([new Relation('Fs = f(Qes)', 'Fs_hz', ['Fs_hz', 'Qes'], predict)]);
    const solve = vi.fn((stated: Parameters<typeof check.check>[0]) => stated);
    const precisionOf = vi.fn(() => 0.1);

    const issues = check.check({Fs_hz: 10, Qes: 1}, solve, precisionOf);

    expect(predict).toHaveBeenCalledWith({Fs_hz: 10, Qes: 1});
    expect(predict).toHaveBeenCalledWith({Fs_hz: 10, Qes: 1.1});
    expect(issues).toHaveLength(1);
    // gap 5, its own half-width 0.1 closes: (5 - 0.1) / 10
    const issue = issues[0];
    expect(issue).toMatchObject({kind: 'inconsistent-inputs', target: 'Fs_hz', expected: 5, actual: 10});
    if (issue === undefined || !('relative' in issue)) throw new Error('expected an inconsistent-inputs issue with a relative gap');
    expect(issue.relative).toBeCloseTo(0.49, 12);
  });
});
