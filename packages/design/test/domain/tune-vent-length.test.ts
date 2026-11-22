/**
 * Tune asks the vent window directly for the length that gives a dragged Fb (spec G1). The vent
 * window's `lengthForTuning_m` is pinned here against WinISD's own Vents-tab length for the W5-1138SMF
 * vented project: capture `fixtures/winisd-edit-captures/w5/vented-load-endcorr0732.json`
 * (end correction 0.732, WinISD's default), the figure WinISD printed in the Vents tab.
 * The formula itself is pinned in engine/vent-length.test.ts; the end-correction effect in
 * project-vent-length.test.ts.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {assertReadout, loadBase, loadLoadCapture, VENT_LENGTH} from '../fixtures/winisdEditCapture.js';

describe('Tune vent length: the vent window gives the length WinISD prints for the project\'s Vb and Fb', () => {
  const capture = loadLoadCapture('w5', 'vented-load-endcorr0732');
  const project = loadBase(capture);
  const vb = project.box.vented.volume_m3.value;
  const fb = project.box.vented.tuning_goal_hz.value;

  it('length for the stored Vb and Fb equals WinISD\'s printed vent length', () => {
    assert.ok(vb !== null && fb !== null);
    assertReadout(capture, VENT_LENGTH, project.box.vented.vent.lengthForTuning_m(vb, fb), 'vent length');
  });

  it('a higher dragged Fb asks for a shorter vent, a lower Fb for a longer one', () => {
    const at = (f: number): number => project.box.vented.vent.lengthForTuning_m(vb, f)!;
    assert.ok(at(fb! + 5) < at(fb!) && at(fb!) < at(fb! - 5));
  });

  it('gives null where there is no volume or no tuning to solve for', () => {
    assert.equal(project.box.vented.vent.lengthForTuning_m(null, fb!), null);
    assert.equal(project.box.vented.vent.lengthForTuning_m(vb, 0), null);
  });
});
