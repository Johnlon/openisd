/**
 * viewSnapshot — the chart view (sweep range, per-chart Y ranges) travels in the saved view state, so it
 * survives a restart. bugs/archive/BUG_20260926_sweep-range-and-y-ranges-not-persisted.md
 */
import {describe, expect, it} from 'vitest';
import assert from 'node:assert/strict';
import {applyViewSnapshot, currentViewSnapshot} from '../../src/logic/appState.js';
import {presentationState} from '../../src/logic/presentationState.js';
import {NumberField} from '@openisd/design/fields';

describe('viewSnapshot — chart ranges', () => {
  it('currentViewSnapshot carries the sweep range and Y ranges', () => {
    presentationState.sweepRange = {min: 1.111, max: 22222};
    presentationState.yRanges = {SPL: {min: -11, max: 111}};

    expect(currentViewSnapshot().chart).toEqual({sweepRange: {min: 1.111, max: 22222}, yRanges: {SPL: {min: -11, max: 111}}});
  });

  it('applyViewSnapshot restores the sweep range and Y ranges', () => {
    applyViewSnapshot({ui: {}, chart: {sweepRange: {min: 3.333, max: 4444}, yRanges: {Zmag: {min: 5, max: 55}}}});

    expect(presentationState.sweepRange).toEqual({min: 3.333, max: 4444});
    expect(presentationState.yRanges).toEqual({Zmag: {min: 5, max: 55}});
  });
});

describe('viewSnapshot — unit choices', () => {
  it('applyViewSnapshot moves an older save\'s short-named unit choice to its field and drops what it cannot read', () => {
    applyViewSnapshot({ui: {unitTokens: {Vb: 'cuft', noSuchKey: 'kHz'}}});

    expect(presentationState.ui.unitTokens).toEqual({[NumberField.BOX_VB_L.value]: 'cuft'});
    expect(NumberField.BOX_VB_L.unitTokenFor(presentationState.ui.unitTokens ?? {})).toBe('cuft');
  });
});

/**
 * QO168 (2026-09-21) takes S10/QO130's project-scoping of the graph cursor one step further:
 * the four fast-changing cursor fields (crosshair f, pinnedF, locked, drag-band range) are OUT
 * of the saved record ENTIRELY — never `.owpr`, never a share link, never the view-state
 * autosave (`OpenISDProject.cursorF` etc. are plain in-memory instance state, a documented
 * exception in `architecture-project-has-three-fields.test.ts`). `graphs`/`lossMode` (QO130)
 * are project data now too, persisted via `OpenISDProject.graphs`/`.lossMode` inside
 * `project.toOwprText()` — a share link's project text already carries them, so `ViewSnapshot`
 * does not need to carry them a second time either. `ViewSnapshot` shrinks to `{ ui }` alone.
 */
describe('viewSnapshot — carries only ui and chart, cursor/graphs/lossMode live on the project', () => {
  it('currentViewSnapshot() carries no cursor, graphs, or lossMode key', () => {
    const snapshot = currentViewSnapshot();
    assert.deepEqual(Object.keys(snapshot), ['ui', 'chart'],
      'cursor is QO168-exempt from every saved record; graphs/lossMode are now project data ' +
      '(QO130), already carried inside the project text; chart is the app-level sweep/Y ranges ' +
      '(BUG_20260926_sweep-range-and-y-ranges-not-persisted)');
  });
});

