/**
 * Two open projects never share an id (T622, QO312): opening the same .owpr file twice gives the
 * second copy a new id.
 */
import {describe, expect, it} from 'vitest';
import {OpenISDProject, ProjectBuilder} from '@openisd/design';
import {createAppStateFixture} from '../fixtures/appStateFixture.js';

function savedText(): string {
  return ProjectBuilder.empty(createAppStateFixture().appState.engine).toOwprText();
}

describe('opening a file whose project is already open', () => {
  it('gives the second copy a new id, and leaves the first as it was', () => {
    const {appState} = createAppStateFixture();
    const text = savedText();
    const first = OpenISDProject.fromOwprText(text, appState.engine);
    const second = OpenISDProject.fromOwprText(text, appState.engine);
    if (Array.isArray(first) || Array.isArray(second)) throw new Error('the file must load');
    const firstId = first.uuid();
    expect(second.uuid()).toBe(firstId);

    appState.addProject(first);
    appState.addProject(second);

    expect(first.uuid()).toBe(firstId);
    expect(second.uuid()).not.toBe(firstId);
    expect(new Set(appState.openProjects().map(p => p.uuid())).size).toBe(2);
  });

  it('a project loaded over the focused one that shares another open project\'s id gets a new id', () => {
    const {appState} = createAppStateFixture();
    const text = savedText();
    const a = OpenISDProject.fromOwprText(text, appState.engine);
    const other = ProjectBuilder.empty(appState.engine);
    const copy = OpenISDProject.fromOwprText(text, appState.engine);
    if (Array.isArray(a) || Array.isArray(copy)) throw new Error('the file must load');
    appState.addProject(a);
    appState.addProject(other);

    appState.applyLoadedProject(copy);

    expect(copy.uuid()).not.toBe(a.uuid());
    expect(new Set(appState.openProjects().map(p => p.uuid())).size).toBe(2);
  });
});
