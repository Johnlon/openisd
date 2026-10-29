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
import {copyChartDefinition, cycleTraceColor, traceColor} from '../../src/logic/presentationState.js';
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


describe('project-list colour rotation', () => {
  it('skips colours occupied by other open projects, including custom uppercase spellings', () => {
    appState.newProject(); const a = appState.openProjects().at(-1)!;
    appState.newProject(); const b = appState.openProjects().at(-1)!;
    a.traceColor.set('#c9c92e'); b.traceColor.set('#E34B4B');
    cycleTraceColor(a, appState.openProjects());
    assert.equal(traceColor(a), '#3a7bd5');
    assert.equal(traceColor(b), '#E34B4B');
  });

  it('finds an unused custom colour when the standard palette is occupied', () => {
    const palette = ['#c9c92e','#e34b4b','#3a7bd5','#2e8b57','#c23bc2','#2ec9c9','#e08a2e'];
    for (const colour of palette) {
      appState.newProject(); appState.openProjects().at(-1)!.traceColor.set(colour);
    }
    const a = appState.openProjects().at(-1)!;
    const before = traceColor(a);
    cycleTraceColor(a, appState.openProjects());
    assert.notEqual(traceColor(a), before);
    assert.ok(!palette.includes(traceColor(a)));
    assert.match(traceColor(a), /^#[0-9a-f]{6}$/);
  });
});


it('copies independent chart definitions without changing the target design or colour', () => {
  appState.newProject(); const source = appState.openProjects().at(-1)!;
  appState.newProject(); const target = appState.openProjects().at(-1)!;
  source.graphs.set(['SPL','Zmag']); source.sweepN.set(800);
  target.box.boxType.set('sealed'); target.box.volumeOf('sealed').set(0.033);
  const colour = traceColor(target), driver = target.driver.model.value;
  copyChartDefinition(source, target);
  assert.deepEqual(target.graphs.value, ['SPL','Zmag']);
  assert.equal(target.sweepN.value, 800);
  assert.equal(target.box.volumeOf('sealed').value, 0.033);
  assert.equal(target.driver.model.value, driver);
  assert.equal(traceColor(target), colour);
  source.graphs.set(['GD']);
  assert.deepEqual(target.graphs.value, ['SPL','Zmag']);
});
