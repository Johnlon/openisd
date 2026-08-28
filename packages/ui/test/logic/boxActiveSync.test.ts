/**
 * `state.box` (the UI's box-type selector) and `ManagedProject`'s `OpenISDBox.active` (what
 * every `Vb`/`ventD`/`Fb`/`activeVent` accessor reads — ledger QO54) must be THE SAME FACT,
 * not two independently-writable copies.
 *
 * `BoxType` (@openisd/design/engine: 'sealed'|'vented'|'pr'|'bandpass4') and `BoxType`
 * (@openisd/model: 'sealed'|'vented'|'bandpass4'|'box-passive-radiator') spell the PR case
 * differently — 'pr' vs 'box-passive-radiator' — so the sync is a translation, not a bare
 * assignment; that translation is what most needs a test, since a typo in either string
 * silently degrades to "the mapping does nothing" rather than a type error.
 */
import { describe, it } from 'vitest';

/** Read one dormant-or-active slot off an INDEPENDENT snapshot: switching the copy's
 *  box-type accessor is safe (it is a copy) and is the public route to a dormant slot's value. */
function slotOf(p: import('@openisd/model').OpenISDProject, kind: 'sealed' | 'vented' | 'bandpass4' | 'box-passive-radiator') {
  p.setBoxType(kind);
  return p;
}

import assert from 'node:assert/strict';
import { state, requireFocusedProject, applyLoadedProject } from '../../src/logic/appState.js';
import { OpenISDProject } from '@openisd/model';
import { OpenISDDriver } from '@openisd/model';
import type { UiParams } from '@openisd/model';

/** A project built the same way `applyLoadedProject()`'s caller (the repo) builds one — via
 *  `OpenISDProject`'s own restore surface, not a second construction path. */
function projectOf(box: 'sealed' | 'vented' | 'bandpass4' | 'box-passive-radiator', params: Partial<UiParams>): OpenISDProject {
  const project = OpenISDProject.empty(OpenISDDriver.empty());
  project.loadUiParams(params, box);
  project.setProjectMeta({ name: '', creator: '', created: '', modified: '', description: '' });
  return project;
}

describe('state.box drives the project\'s active box type', () => {
  for (const box of ['sealed', 'vented', 'bandpass4', 'box-passive-radiator'] as const) {
    it(`state.box = '${box}' makes it the project's active box type`, () => {
      state.box = box;
      const expected = box;
      assert.equal(requireFocusedProject().snapshot().activeBoxType(), expected);
    });
  }

  it('switching box type does not clobber the volume left behind in the other box type', () => {
    state.box = 'vented';
    requireFocusedProject().setBoxVolume_m3(0.041);
    state.box = 'sealed';
    requireFocusedProject().setBoxVolume_m3(0.019);
    assert.equal(slotOf(requireFocusedProject().snapshot(), 'vented').cell('Vb').value, 0.041,
      'the vented volume typed in before switching away must survive');
    assert.equal(slotOf(requireFocusedProject().snapshot(), 'sealed').cell('Vb').value, 0.019);
    state.box = 'vented';
    assert.equal(requireFocusedProject().boxVolume_m3(), 0.041, 'switching back reads the SAME field it read before');
  });
});

describe('applyLoadedProject — a restored box type takes effect before the restored P is applied', () => {
  // `OpenISDProject.loadUiParams` sets the active box type BEFORE writing the restored params.
  // That order matters: `Vb`/`ventD`/`Fb` each pick their storage by the ACTIVE box type
  // (ledger QO54), so applying a sealed design's Vb while 'vented' is still active would
  // silently write it into the vented box type instead.
  it('restoring a sealed design lands Vb in sealed, not in whatever was active before', () => {
    state.box = 'vented';   // simulate a session that was on a different box type
    const saved = projectOf('sealed', { Vb: 0.0275 });

    applyLoadedProject(saved);

    assert.equal(state.box, 'sealed');
    assert.equal(slotOf(requireFocusedProject().snapshot(), 'sealed').cell('Vb').value, 0.0275,
      'the restored Vb must land in the box type the restored box type just activated');
  });

  it('a restored entered set replaces the previous one, not merges with it', () => {
    state.box = 'vented';
    requireFocusedProject().setEnteredSet({ Vb: true, ventD: true, Fb: true });
    applyLoadedProject(projectOf('vented', { entered: { ventL: true } }));
    assert.equal(requireFocusedProject().isEntered('ventL'), true);
    assert.equal(requireFocusedProject().isEntered('Fb'), false,
      'a field entered before the restore must not survive it — the restored set is authoritative');
  });
});
