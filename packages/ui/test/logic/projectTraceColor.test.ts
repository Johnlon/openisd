/**
 * A project's trace/legend colour is a PROJECT ATTRIBUTE — assigned once when it opens and
 * stable from then on, never recomputed from the project's position in the open-project list.
 * Bug: colour was `DPAL[di % DPAL.length]` keyed by array position, so switching which project
 * was focused reshuffled `di` for every other open project and repainted their lines a
 * different colour; the toolbar's colour-picker swatch was a page-level index that never
 * reflected the focused project's own colour either (John, 2026-09-24).
 */
import {describe, it, beforeEach} from 'vitest';
import assert from 'node:assert/strict';
import {cycleTraceColor, traceColor} from '../../src/logic/presentationState.js';
import {createAppStateFixture} from '../fixtures/appStateFixture.js';
import type {AppState} from '../../src/logic/appState.js';

let appState: AppState;

beforeEach(() => {
  const fixture = createAppStateFixture();
  appState = fixture.appState;
});

describe('project trace colour is per-project, not per-position', () => {
  it('assigns distinct colours to distinct open projects', () => {
    const before = appState.openProjects().length;
    appState.newProject();
    const a = appState.openProjects()[appState.openProjects().length - 1];
    appState.newProject();
    const b = appState.openProjects()[appState.openProjects().length - 1];

    assert.notEqual(traceColor(a), traceColor(b));

    appState.removeProject(appState.openProjects().indexOf(b));
    appState.removeProject(appState.openProjects().indexOf(a));
    void before;
  });

  it('keeps a project\'s own colour stable when focus moves to a different project', () => {
    appState.newProject();
    const a = appState.openProjects()[appState.openProjects().length - 1];
    appState.newProject();
    const b = appState.openProjects()[appState.openProjects().length - 1];
    const colorA = traceColor(a);

    appState.focusProject(appState.openProjects().indexOf(a));
    appState.focusProject(appState.openProjects().indexOf(b));
    appState.focusProject(appState.openProjects().indexOf(a));

    assert.equal(traceColor(a), colorA);

    appState.removeProject(appState.openProjects().indexOf(b));
    appState.removeProject(appState.openProjects().indexOf(a));
  });

  it('cycleTraceColor changes only the named project\'s own colour', () => {
    appState.newProject();
    const a = appState.openProjects()[appState.openProjects().length - 1];
    appState.newProject();
    const b = appState.openProjects()[appState.openProjects().length - 1];
    const colorB = traceColor(b);

    cycleTraceColor(a);

    assert.equal(traceColor(b), colorB);

    appState.removeProject(appState.openProjects().indexOf(b));
    appState.removeProject(appState.openProjects().indexOf(a));
  });

  it('cycleTraceColor saves the new colour in the project itself (BUG_20260926_trace-colour-not-persisted)', () => {
    appState.newProject();
    const a = appState.openProjects()[appState.openProjects().length - 1];

    cycleTraceColor(a);

    assert.equal(a.traceColor.value, traceColor(a));
    appState.removeProject(appState.openProjects().indexOf(a));
  });

  it('a project that carries a saved colour keeps it when it is opened', () => {
    appState.newProject();
    const a = appState.openProjects()[appState.openProjects().length - 1];
    a.traceColor.set('#123456');
    appState.removeProject(appState.openProjects().indexOf(a));

    appState.addProject(a);

    assert.equal(traceColor(a), '#123456');
    appState.removeProject(appState.openProjects().indexOf(a));
  });
});
