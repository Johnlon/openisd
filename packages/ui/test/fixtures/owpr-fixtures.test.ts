/**
 * The `.owpr` fixtures browser specs open via `openAProject()` (`../fixtures.ts`) must actually
 * parse under the CURRENT schema — a fixture that drifts out of shape (S2-7b/S5 turned the old
 * `tuning_goal_hz`/`length_m`/`addedMass_kg`/`signal.voltage_V` shape into a parse error, QO152) fails
 * every browser spec that opens it with a 60 s timeout instead of a clear reason. This is the
 * unit-level guard: it fails fast, and in the process it guards the fixtures against future
 * schema drift too.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {OpenISDProject} from '@openisd/design';
import {Engine} from '@openisd/design/engine';
import {
  ensureCompleteDriverProject,
  ensureSampleProject,
} from './sampleProject.js';

describe('browser-spec .owpr fixtures parse under the current schema (QO152)', () => {
  it('sample-project.owpr loads', () => {
    const path = ensureSampleProject();
    const text = readFileSync(path, 'utf8');
    const result = OpenISDProject.fromOwprText(text, new Engine());
    if (Array.isArray(result)) {
      throw new Error(`sample-project.owpr failed to parse: ${result.join('; ')}`);
    }
    assert.ok(result instanceof OpenISDProject);
  });

  it('complete-driver-project.owpr loads a genuinely consistent driver — no dq on the Q trio (S9a Cluster 7)', () => {
    const path = ensureCompleteDriverProject();
    const text = readFileSync(path, 'utf8');
    const result = OpenISDProject.fromOwprText(text, new Engine());
    if (Array.isArray(result)) {
      throw new Error(`complete-driver-project.owpr failed to parse: ${result.join('; ')}`);
    }
    const ts = result.driver.specs;
    assert.deepEqual(ts.Qts.dq, []);
    assert.deepEqual(ts.Qes.dq, []);
    assert.deepEqual(ts.Qms.dq, []);
  });
});
