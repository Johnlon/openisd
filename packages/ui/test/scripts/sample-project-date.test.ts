/**
 * The sample projects carry one fixed date, FIXTURE_DATE, never the day they were generated: the
 * Project tab shows Created and Modified, and a wall-clock date made a visual screen shot one day fail
 * the next (F48). The visual screens run the page on the same date.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {FIXTURE_DATE, readCompleteDriverProject, readSampleProject} from '../fixtures/sampleProject.js';

const dated = z.object({saved: z.object({meta: z.object({created: z.string(), modified: z.string()})})});

describe('sample projects are dated FIXTURE_DATE', () => {
  const stamp = FIXTURE_DATE.toISOString().slice(0, 10).replaceAll('-', '');

  it('FIXTURE_DATE is 16 Oct 2026, the day the visual baselines were shot', () => {
    assert.equal(stamp, '20261016');
  });

  for (const [name, read] of [['sample-project', readSampleProject], ['complete-driver-project', readCompleteDriverProject]] as const) {
    it(`${name}: Created and Modified are FIXTURE_DATE`, () => {
      const {saved} = dated.parse(JSON.parse(read().toString('utf8')));
      assert.deepEqual([saved.meta.created, saved.meta.modified], [stamp, stamp]);
    });
  }
});
