import {describe, expect, it} from 'vitest';
import {OpenISDDriver, ProjectBuilder, type OpenISDProject} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {deleteStoredProject} from '../../src/logic/storedProjectDelete.js';
import type {ConfirmPort, ConfirmRequest} from '../../src/logic/confirmPort.js';

const engine = createEngine();
const projectOf = (): OpenISDProject => new ProjectBuilder(OpenISDDriver.empty(engine), engine).sealed().volume_m3(0.02).build();

class FakeConfirm implements ConfirmPort {
  asked: ConfirmRequest[] = [];
  constructor(private readonly answer: boolean) {}
  ask(request: ConfirmRequest): Promise<boolean> {
    this.asked.push(request);
    return Promise.resolve(this.answer);
  }
}

function harness(answer: boolean, openId: string | null, stored: 'done' | 'refused' = 'done') {
  const open = [projectOf(), projectOf()];
  const removed: number[] = [];
  const deleted: string[] = [];
  const appState = {
    openProjects: () => open,
    removeProject: (index: number) => { removed.push(index); },
  };
  const repo = {
    deleteStoredProject: (id: string) => { deleted.push(id); return stored; },
    storedIdOf: (project: OpenISDProject) => (project === open[1] ? openId : null),
  };
  return {appState, repo, confirm: new FakeConfirm(answer), removed, deleted};
}

describe('deleteStoredProject', () => {
  it('asks, naming the project, and does nothing when the user cancels', async () => {
    const h = harness(false, 'p-1');
    expect(await deleteStoredProject(h.appState, h.repo, h.confirm, 'p-1', 'Sub')).toBe('cancelled');
    expect(h.confirm.asked[0]?.message).toBe('Delete "Sub"? It is removed from this browser and from Drive on every synced device. A backup is taken first.');
    expect(h.deleted).toEqual([]);
    expect(h.removed).toEqual([]);
  });

  it('deletes it from the store and closes it when it is open', async () => {
    const h = harness(true, 'p-1');
    expect(await deleteStoredProject(h.appState, h.repo, h.confirm, 'p-1', 'Sub')).toBe('deleted');
    expect(h.deleted).toEqual(['p-1']);
    expect(h.removed).toEqual([1]);
  });

  it('deletes a project that is not open without closing anything', async () => {
    const h = harness(true, null);
    expect(await deleteStoredProject(h.appState, h.repo, h.confirm, 'p-1', 'Sub')).toBe('deleted');
    expect(h.removed).toEqual([]);
  });

  it('keeps an open project open when the store refuses', async () => {
    const h = harness(true, 'p-1', 'refused');
    expect(await deleteStoredProject(h.appState, h.repo, h.confirm, 'p-1', 'Sub')).toBe('refused');
    expect(h.removed).toEqual([]);
  });
});
