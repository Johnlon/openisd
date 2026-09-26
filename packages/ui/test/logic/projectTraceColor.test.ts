/**
 * A project's trace/legend colour is a PROJECT ATTRIBUTE — assigned once when it opens and
 * stable from then on, never recomputed from the project's position in the open-project list.
 * Bug: colour was `DPAL[di % DPAL.length]` keyed by array position, so switching which project
 * was focused reshuffled `di` for every other open project and repainted their lines a
 * different colour; the toolbar's colour-picker swatch was a page-level index that never
 * reflected the focused project's own colour either (John, 2026-09-24).
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {addProject, focusProject, newProject, openProjects, removeProject} from '../../src/logic/appState.js';
import {cycleTraceColor, traceColor} from '../../src/logic/presentationState.js';

describe('project trace colour is per-project, not per-position', () => {
  it('assigns distinct colours to distinct open projects', () => {
    const before = openProjects().length;
    newProject();
    const a = openProjects()[openProjects().length - 1];
    newProject();
    const b = openProjects()[openProjects().length - 1];

    assert.notEqual(traceColor(a), traceColor(b));

    removeProject(openProjects().indexOf(b));
    removeProject(openProjects().indexOf(a));
    void before;
  });

  it('keeps a project\'s own colour stable when focus moves to a different project', () => {
    newProject();
    const a = openProjects()[openProjects().length - 1];
    newProject();
    const b = openProjects()[openProjects().length - 1];
    const colorA = traceColor(a);

    focusProject(openProjects().indexOf(a));
    focusProject(openProjects().indexOf(b));
    focusProject(openProjects().indexOf(a));

    assert.equal(traceColor(a), colorA);

    removeProject(openProjects().indexOf(b));
    removeProject(openProjects().indexOf(a));
  });

  it('cycleTraceColor changes only the named project\'s own colour', () => {
    newProject();
    const a = openProjects()[openProjects().length - 1];
    newProject();
    const b = openProjects()[openProjects().length - 1];
    const colorB = traceColor(b);

    cycleTraceColor(a);

    assert.equal(traceColor(b), colorB);

    removeProject(openProjects().indexOf(b));
    removeProject(openProjects().indexOf(a));
  });

  it('cycleTraceColor saves the new colour in the project itself (BUG_20260926_trace-colour-not-persisted)', () => {
    newProject();
    const a = openProjects()[openProjects().length - 1];

    cycleTraceColor(a);

    assert.equal(a.traceColor.value, traceColor(a));
    removeProject(openProjects().indexOf(a));
  });

  it('a project that carries a saved colour keeps it when it is opened', () => {
    newProject();
    const a = openProjects()[openProjects().length - 1];
    a.traceColor.set('#123456');
    removeProject(openProjects().indexOf(a));

    addProject(a);

    assert.equal(traceColor(a), '#123456');
    removeProject(openProjects().indexOf(a));
  });
});
