/**
 * `state.box` (the UI's box-type selector) and `ManagedProject`'s `OpenISDBox.active` (what
 * every `Vb`/`ventD`/`Fb`/`activeVent` accessor reads — ledger QO54) must be THE SAME FACT,
 * not two independently-writable copies.
 *
 * `BoxType` (@openisd/engine: 'sealed'|'vented'|'pr'|'bandpass4') and `AlignmentKind`
 * (@openisd/model: 'sealed'|'vented'|'bandpass4'|'passive-radiator') spell the PR case
 * differently — 'pr' vs 'passive-radiator' — so the sync is a translation, not a bare
 * assignment; that translation is what most needs a test, since a typo in either string
 * silently degrades to "the mapping does nothing" rather than a type error.
 */
import { describe, it } from 'vitest';

/** Read one dormant-or-active slot off an INDEPENDENT snapshot: switching the copy's
 *  alignment is safe (it is a copy) and is the public route to a dormant slot's value. */
function slotOf(p: import('@openisd/model').OpenISDProject, kind: 'sealed' | 'vented' | 'bandpass4' | 'passive-radiator') {
  p.setAlignment(kind);
  return p;
}

import assert from 'node:assert/strict';
import { state, managedProject, applyState } from '../../src/logic/appState.js';
import type { SerializedState, UiParams } from '../../src/types.js';

describe('state.box drives the project\'s active alignment', () => {
  for (const box of ['sealed', 'vented', 'bandpass4', 'pr'] as const) {
    it(`state.box = '${box}' makes it the project's active alignment`, () => {
      state.box = box;
      const expected = box === 'pr' ? 'passive-radiator' : box;
      assert.equal(managedProject._snapshot().activeAlignment(), expected);
    });
  }

  it('switching box type does not clobber the volume left behind in the other alignment', () => {
    state.box = 'vented';
    managedProject.setBoxVolume_m3(0.041);
    state.box = 'sealed';
    managedProject.setBoxVolume_m3(0.019);
    assert.equal(slotOf(managedProject._snapshot(), 'vented').volume_m3(), 0.041,
      'the vented volume typed in before switching away must survive');
    assert.equal(slotOf(managedProject._snapshot(), 'sealed').volume_m3(), 0.019);
    state.box = 'vented';
    assert.equal(managedProject.boxVolume_m3(), 0.041, 'switching back reads the SAME field it read before');
  });
});

describe('applyState — a restored box type takes effect before the restored P is applied', () => {
  // `applyState` (appState.ts) sets the active alignment BEFORE writing the restored params
  // (`managedProject.loadUiParams`). That order matters: `Vb`/`ventD`/`Fb` each pick their
  // storage by the ACTIVE alignment (ledger QO54), so applying a sealed design's Vb while
  // 'vented' is still active would silently write it into the vented alignment instead.
  it('restoring a sealed design lands Vb in sealed, not in whatever was active before', () => {
    state.box = 'vented';   // simulate a session that was on a different box type
    const saved: SerializedState = {
      box: 'sealed',
      P: { Vb: 0.0275 } as UiParams,
      graphs: [],
    } as unknown as SerializedState;

    applyState(saved);

    assert.equal(state.box, 'sealed');
    assert.equal(slotOf(managedProject._snapshot(), 'sealed').volume_m3(), 0.0275,
      'the restored Vb must land in the alignment the restored box type just activated');
  });

  it('a restored entered set replaces the previous one, not merges with it', () => {
    state.box = 'vented';
    managedProject.setEnteredSet({ Vb: true, ventD: true, Fb: true });
    applyState({
      box: 'vented',
      P: { entered: { ventL: true } } as unknown as UiParams,
      graphs: [],
    } as unknown as SerializedState);
    assert.equal(managedProject.isEntered('ventL'), true);
    assert.equal(managedProject.isEntered('Fb'), false,
      'a field entered before the restore must not survive it — the restored set is authoritative');
  });
});
