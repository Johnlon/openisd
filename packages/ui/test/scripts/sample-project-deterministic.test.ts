/**
 * The generated sample projects are the same bytes every time they are generated (T834, QO924: a picture's content is
 * deterministic, and a mask is not a way to hide variation that has a cause). The generator minted the project's id and the
 * embedded driver's id at random, so a stored backup of the project packed to a size that differed by a few characters from run
 * to run, and "4.7 KB" and "4.8 KB" drew differently in the same visual re-take (T830).
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {COMPLETE_DRIVER_PROJECT_OWPR, SAMPLE_PROJECT_OWPR} from '../fixtures/sampleProject.js';

const GENERATOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'generateSample.ts');

/** Runs the generator and returns what it wrote. */
function generated(): {sample: string; complete: string} {
  execFileSync('npx', ['vite-node', GENERATOR], {stdio: 'pipe'});
  return {sample: readFileSync(SAMPLE_PROJECT_OWPR, 'utf8'), complete: readFileSync(COMPLETE_DRIVER_PROJECT_OWPR, 'utf8')};
}

describe('the generated sample projects', () => {
  it('are the same text every time they are generated', () => {
    const first = generated();
    const second = generated();
    assert.equal(second.sample, first.sample);
    assert.equal(second.complete, first.complete);
  });

  it('carry different project ids, so a window holding both never renames one', () => {
    const {sample, complete} = generated();
    const idOf = (text: string): string => z.object({id: z.string()}).parse(JSON.parse(text)).id;
    assert.notEqual(idOf(sample), idOf(complete));
  });
});
