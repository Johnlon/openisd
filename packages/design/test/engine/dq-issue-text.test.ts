/**
 * Every `DqIssue` carries its own sentence. Before this, the text lived in `dqIssueText` and a
 * caller needed an `Engine` to render a field's DQ — which is why the UI hooks held one
 * (John, 2026-09-27: "an missing api on the field/DQ's that it's not reporting it's own DQ").
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {Engine} from '../../engine/index.js';

const engine = new Engine();

describe('a DqIssue reports its own text', () => {
  it('missing-dependencies names the target and the routes', () => {
    const issue = engine.missingDependencies('Vas_m3', [
      {formula: 'Vas = f(Cms, Sd)', required: ['Cms_m_per_N', 'Sd_m2'], missing: ['Cms_m_per_N']},
    ]);
    assert.match(issue.text, /Vas_m3 cannot be calculated yet/);
    assert.match(issue.text, /Cms_m_per_N/);
  });

  it('inconsistent-inputs states the disagreement', () => {
    const issue = engine.inconsistentInputs('Fs_hz', ['Fs_hz', 'Mms_kg'], 'Fs = f(Mms, Cms)', 45, 48.8, 0.085);
    assert.match(issue.text, /Fs_hz, Mms_kg disagree by 8.5%/);
  });

  it('out-of-range names the field, the value and the limit', () => {
    const issue = engine.outOfRange('Re_ohm', 900, 800, 'above');
    assert.match(issue.text, /Re_ohm 900 is above the physical limit 800/);
  });

  it('target-unreachable states the ceiling', () => {
    const issue = engine.targetUnreachable('length_m', 62.5);
    assert.match(issue.text, /maximum this geometry can reach is 62.5 Hz/);
  });

  it('invalid-value and negative-value say what is kept', () => {
    // Both answer `null` for a value that passes their floor; -1 passes neither.
    const invalid = engine.positiveValueIssue(-1);
    const negative = engine.nonNegativeValueIssue(-1);
    assert.ok(invalid !== null && negative !== null, '-1 must break both floors');
    assert.match(invalid.text, /zero or less is not a physical value/);
    assert.match(negative.text, /less than zero is not a physical value/);
  });
});
