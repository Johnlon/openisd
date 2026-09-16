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

const here = dirname(fileURLToPath(import.meta.url));

describe('browser-spec .owpr fixtures parse under the current schema (QO152)', () => {
  for (const name of ['complete-driver-project.owpr', 'sample-project.owpr']) {
    it(`${name} loads`, () => {
      const text = readFileSync(join(here, name), 'utf8');
      const result = OpenISDProject.fromOwprText(text, new Engine());
      if (Array.isArray(result)) {
        throw new Error(`${name} failed to parse: ${result.join('; ')}`);
      }
      assert.ok(result instanceof OpenISDProject);
    });
  }
});
