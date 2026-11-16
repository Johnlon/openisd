/**
 * What a reload really loses (T829). The stored open-project session keeps every unsaved edit, so unsaved
 * edits alone lose nothing; the losses are the exceptions: the store did not take the write, the store is a
 * read-only backup, an open driver editor holds values not applied, a What-if holds values tried.
 */
import {describe, expect, it} from 'vitest';
import {reloadLosses, type ReloadFacts} from '../../src/logic/reloadLosses.js';

const calm: ReloadFacts = {anyUnsaved: false, sessionStored: true, readOnlyStore: false, editorDraftChanged: false, whatIfChanged: false};

describe('reloadLosses', () => {
  it('loses nothing when edits are unsaved but the session holds them', () => {
    expect(reloadLosses({...calm, anyUnsaved: true})).toEqual([]);
  });

  it('loses nothing when nothing is unsaved, even if the store would not take a write', () => {
    expect(reloadLosses({...calm, sessionStored: false})).toEqual([]);
  });

  it('loses the unsaved edits the store did not take', () => {
    expect(reloadLosses({...calm, anyUnsaved: true, sessionStored: false})).toEqual(['unstoredEdits']);
  });

  it('on a read-only backup the unsaved edits are lost, and that is said instead of the store being full', () => {
    expect(reloadLosses({...calm, anyUnsaved: true, readOnlyStore: true, sessionStored: false})).toEqual(['readOnlyStore']);
    expect(reloadLosses({...calm, anyUnsaved: true, readOnlyStore: true, sessionStored: true})).toEqual(['readOnlyStore']);
  });

  it('names an unapplied editor and a What-if in a stable order', () => {
    expect(reloadLosses({...calm, editorDraftChanged: true, whatIfChanged: true})).toEqual(['editorDraft', 'whatIf']);
    expect(reloadLosses({...calm, anyUnsaved: true, sessionStored: false, whatIfChanged: true})).toEqual(['unstoredEdits', 'whatIf']);
  });
});
