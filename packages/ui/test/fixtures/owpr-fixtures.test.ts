/**
 * The `.owpr` fixtures browser specs open via `openAProject()` (`../fixtures.ts`) must actually
 * parse under the CURRENT schema — a fixture that drifts out of shape (S2-7b/S5 turned the old
 * `tuning_hz`/`length_m`/`addedMass_kg`/`signal.voltage_V` shape into a parse error, QO152) fails
 * every browser spec that opens it with a 60 s timeout instead of a clear reason. This is the
 * unit-level guard: it fails fast, and in the process it guards the fixtures against future
 * schema drift too.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { OpenISDProject } from '@openisd/design';
import { Engine } from '@openisd/design/engine';
import { SAMPLE_PROJECT_OWPR } from './sampleProject.js';

const here = dirname(fileURLToPath(import.meta.url));

describe('browser-spec .owpr fixtures parse under the current schema (QO152)', () => {
  for (const name of ['complete-driver-project.owpr', 'sample-project.owpr']) {
    it(`${name} loads`, () => {
      // The sample project is runtime-generated into the git-ignored build/ dir; the other
      // fixtures live in this directory.
      const path = name === 'sample-project.owpr' ? SAMPLE_PROJECT_OWPR : join(here, name);
      const text = readFileSync(path, 'utf8');
      const result = OpenISDProject.fromOwprText(text, new Engine());
      if (Array.isArray(result)) {
        throw new Error(`${name} failed to parse: ${result.join('; ')}`);
      }
      assert.ok(result instanceof OpenISDProject);
    });
  }

  it('complete-driver-project.owpr loads a genuinely consistent driver — no dq on the Q trio (S9a Cluster 7)', () => {
    // Named "complete" — every consistency-checked field the fixture states must actually agree
    // with the others to within the solver's own tolerance, or every browser spec that opens it
    // starts from an unexpectedly-already-flagged driver (consistency-dq.browser.spec.ts:85's
    // first assertion: 0 dq marks before any scrubbing).
    //
    // Checked on the CELLS' own `.dq()` — the project cascade's projection, which is what the
    // Tune panel/driver editor actually render — not `driver.issues()`: a freshly-built
    // `OpenISDDriverEmbedded.issues()` reads its OWN driver-spec `#issues` cache (openisdDomain.ts
    // ~1078), which is a DIFFERENT, apparently not-yet-populated computation from the project's
    // own resolve cascade that writes the persisted `dq_calculated` entries `.dq()` reads — the
    // two disagreed for this exact fixture (`driver.issues()` said `[]`, `.dq()` showed a real
    // "disagree by 0.0%" mark on all three), which is itself worth a separate look.
    const text = readFileSync(join(here, 'complete-driver-project.owpr'), 'utf8');
    const result = OpenISDProject.fromOwprText(text, new Engine());
    if (Array.isArray(result)) {
      throw new Error(`complete-driver-project.owpr failed to parse: ${result.join('; ')}`);
    }
    const ts = result.driver.ts;
    assert.deepEqual(ts.Qts.get().dq(), []);
    assert.deepEqual(ts.Qes.get().dq(), []);
    assert.deepEqual(ts.Qms.get().dq(), []);
  });
});
