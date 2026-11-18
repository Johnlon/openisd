/**
 * With Cloud sync on, a project's unsaved edits get a bar asking to save after 5 minutes, once per
 * project per app session, never while a dialog is open; with sync off nothing happens.
 * John, 18 Nov 2026, QO946.c244 "if cloud sync isn't enabled then don't tell user to save", c245 "ok do that".
 */
import {describe, expect, it} from 'vitest';
import {ProjectBuilder, type OpenISDProject} from '@openisd/design';
import {UNSAVED_ASK_AFTER_MS} from '@openisd/design/cloud';
import type {Timer} from '@openisd/persistence';
import {createUnsavedNudge} from '../../src/logic/unsavedNudge.js';
import {createAppStateFixture} from '../fixtures/appStateFixture.js';

const MINUTE = 60_000;

function setup() {
  const {appState} = createAppStateFixture();
  const clock = {ms: 1_000_000};
  const flags = {syncOn: true, dialogOpen: false, saveWorks: true};
  const flashes: string[] = [];
  const saved: string[] = [];
  const ticks: Array<() => void> = [];
  const timer: Timer = {
    after: () => () => undefined,
    every: (_ms, f) => { ticks.push(f); return () => undefined; },
  };
  const nudge = createUnsavedNudge({
    openProjects: () => appState.openProjects(),
    hasUnsaved: p => appState.projectHasUnsavedChanges(p),
    nameOf: p => appState.projectDisplayName(p),
    syncOn: () => flags.syncOn,
    dialogOpen: () => flags.dialogOpen,
    now: () => clock.ms,
    timer,
    save: async p => {
      if (!flags.saveWorks) return false;
      p.save();
      saved.push(p.name.value);
      return true;
    },
    flash: message => { flashes.push(message); },
  });
  function openProject(name: string): OpenISDProject {
    const project = ProjectBuilder.empty(appState.engine);
    project.name.set(name);
    project.save();
    appState.openProjectOnce(project, {kind: 'stored', id: `id-${name}`});
    return project;
  }
  /** Time passes, with the timer looking at the projects every 10 s. */
  function wait(ms: number): void {
    for (let spent = 0; spent < ms; spent += 10_000) {
      clock.ms += 10_000;
      for (const f of ticks) f();
    }
  }
  function edit(project: OpenISDProject, limit: number): void { project.portVelocityLimit_m_per_s.set(limit); }
  return {nudge, appState, flags, flashes, saved, openProject, wait, edit};
}

describe('the save bar, with Cloud sync on', () => {
  it('appears after 5 minutes of unsaved edits, not before', () => {
    const {nudge, openProject, edit, wait} = setup();
    edit(openProject('Sub 12'), 20);
    wait(UNSAVED_ASK_AFTER_MS - MINUTE);
    expect(nudge.bar.value).toBeNull();
    wait(MINUTE + 10_000);
    expect(nudge.bar.value?.text).toBe('Your changes are not on your other devices yet.');
  });

  it('does not appear for a project with nothing unsaved', () => {
    const {nudge, openProject, wait} = setup();
    openProject('Sub 12');
    wait(10 * MINUTE);
    expect(nudge.bar.value).toBeNull();
  });

  it('asks once per project: after Later it never comes back for that project in the session', () => {
    const {nudge, openProject, edit, wait} = setup();
    edit(openProject('Sub 12'), 20);
    wait(6 * MINUTE);
    expect(nudge.bar.value).not.toBeNull();
    nudge.later();
    expect(nudge.bar.value).toBeNull();
    wait(30 * MINUTE);
    expect(nudge.bar.value).toBeNull();
  });

  it('does not ask again for a project that was saved and edited anew: once per project per session', () => {
    const {nudge, openProject, edit, wait} = setup();
    const project = openProject('Sub 12');
    edit(project, 20);
    wait(6 * MINUTE);
    const first = nudge.bar.value;
    expect(first).not.toBeNull();
    project.save();
    wait(10_000);
    expect(nudge.bar.value).toBeNull();
    edit(project, 21);
    wait(10 * MINUTE);
    expect(nudge.bar.value).toBeNull();
  });

  it('asks for another project, which has its own 5 minutes', () => {
    const {nudge, openProject, edit, wait} = setup();
    const first = openProject('Sub 12');
    edit(first, 20);
    wait(6 * MINUTE);
    nudge.later();
    const second = openProject('Tower');
    edit(second, 20);
    wait(3 * MINUTE);
    expect(nudge.bar.value).toBeNull();
    wait(3 * MINUTE);
    expect(nudge.bar.value?.id).toBe(second.uuid());
  });

  it('waits while a dialog is open and appears when it closes', () => {
    const {nudge, flags, openProject, edit, wait} = setup();
    edit(openProject('Sub 12'), 20);
    flags.dialogOpen = true;
    wait(10 * MINUTE);
    expect(nudge.bar.value).toBeNull();
    flags.dialogOpen = false;
    wait(10_000);
    expect(nudge.bar.value).not.toBeNull();
  });

  it('Save saves that project, says so and takes the bar away', async () => {
    const {nudge, openProject, edit, wait, saved, flashes} = setup();
    const project = openProject('Sub 12');
    edit(project, 20);
    wait(6 * MINUTE);
    const bar = nudge.bar.value;
    if (bar === null) throw new Error('the bar should be showing');
    expect(await nudge.save(bar.id)).toBe(true);
    expect(saved).toEqual(['Sub 12']);
    expect(flashes).toEqual(['Saved Sub 12']);
    expect(nudge.bar.value).toBeNull();
  });

  it('keeps the bar when the save is refused', async () => {
    const {nudge, flags, openProject, edit, wait, flashes} = setup();
    edit(openProject('Sub 12'), 20);
    wait(6 * MINUTE);
    flags.saveWorks = false;
    const bar = nudge.bar.value;
    if (bar === null) throw new Error('the bar should be showing');
    expect(await nudge.save(bar.id)).toBe(false);
    expect(flashes).toEqual([]);
    expect(nudge.bar.value).not.toBeNull();
  });

  it('lists the open projects with unsaved changes', () => {
    const {nudge, openProject, edit} = setup();
    edit(openProject('Sub 12'), 20);
    openProject('Tower');
    expect(nudge.unsavedProjects().map(p => p.name)).toEqual(['Sub 12']);
  });
});

describe('the save bar, with Cloud sync off', () => {
  it('never appears and lists nothing, however long edits stay unsaved', () => {
    const {nudge, flags, openProject, edit, wait} = setup();
    flags.syncOn = false;
    edit(openProject('Sub 12'), 20);
    wait(60 * MINUTE);
    expect(nudge.bar.value).toBeNull();
    expect(nudge.unsavedProjects()).toEqual([]);
  });

  it('counts the 5 minutes from when sync came on, not from before', () => {
    const {nudge, flags, openProject, edit, wait} = setup();
    flags.syncOn = false;
    edit(openProject('Sub 12'), 20);
    wait(60 * MINUTE);
    flags.syncOn = true;
    wait(MINUTE);
    expect(nudge.bar.value).toBeNull();
    wait(5 * MINUTE);
    expect(nudge.bar.value).not.toBeNull();
  });
});
