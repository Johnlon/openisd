import {describe, expect, test} from 'vitest';
import {NO_OPEN_WHY, NoOpenReason, WalkSkin, walkTargets} from '../fixtures/viewOpen.js';
import {EXTRA_OPEN_STEPS, VIEW_REASONS} from '../fixtures/viewOpenSteps.js';
import {VIEW_INDEX} from '../fixtures/viewIndex.js';

/**
 * View coverage (T763): every (view, skin) of the view index has an open step for the layout walk
 * (view-layout-walk.browser.spec.ts) or one NoOpenReason, and the number of reasons may only go down.
 * A view added to the index with neither is a reason by default, so it raises the count and this fails.
 */

/** The number of (view, skin) pairs that have a reason instead of an open step. Lower it when a step is written; the test fails if the count rises. */
const REASON_CEILING = 126;

const targets = walkTargets();

describe('view index coverage', () => {
  test('every view has an open step or a reason, and the reasons only go down', () => {
    const withReason = targets.filter(target => target.plan.kind === 'reason');
    for (const target of withReason) expect(Object.values(NoOpenReason), target.view.id).toContain(target.plan.kind === 'reason' ? target.plan.reason : undefined);
    const byReason = Object.values(NoOpenReason).map(reason => `${reason}=${withReason.filter(target => target.plan.kind === 'reason' && target.plan.reason === reason).length}`);
    console.log(`view walk: ${targets.length - withReason.length} opened, ${withReason.length} with a reason (${byReason.join(', ')}); ${NO_OPEN_WHY[NoOpenReason.StepNotWritten]}`);
    expect(withReason.length, 'views with a reason may only go down: lower REASON_CEILING when a step is written').toBeLessThanOrEqual(REASON_CEILING);
    expect(withReason.length, 'a step was written: lower REASON_CEILING to the new count so it cannot creep back').toBeGreaterThanOrEqual(REASON_CEILING);
  });

  test('the step and reason tables name only views that are in the index', () => {
    const known = new Set(VIEW_INDEX.flatMap(view => Object.values(WalkSkin).map(skin => `${skin}:${view.id}`)));
    expect([...EXTRA_OPEN_STEPS.keys(), ...VIEW_REASONS.keys()].filter(entry => !known.has(entry))).toEqual([]);
  });
});
