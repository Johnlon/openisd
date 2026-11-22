import {describe, expect, it} from 'vitest';
import {OpenISDDriver, ProjectBuilder, type OpenISDProject} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {deleteForever, emptyBin, moveToBin} from '../../src/logic/projectBinActions.js';
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

function harness(answer: boolean, opts: {openId?: string; unsaved?: boolean; binResult?: 'done' | 'refused'} = {}) {
  const open = [projectOf(), projectOf()];
  const calls: string[] = [];
  const appState = {
    openProjects: () => open,
    removeProject: (index: number) => { calls.push(`close ${index}`); },
    projectHasUnsavedChanges: () => opts.unsaved ?? false,
  };
  const repo = {
    storedIdOf: (p: OpenISDProject) => (p === open[1] ? opts.openId ?? null : null),
    saveToStorage: () => { calls.push('save'); return {kind: 'saved' as const}; },
  };
  const bin = {
    moveToBin: (id: string) => { calls.push(`bin ${id}`); return opts.binResult ?? 'done'; },
    deleteForever: (id: string) => { calls.push(`forever ${id}`); return 'done' as const; },
    emptyBin: () => { calls.push('empty'); return 'done' as const; },
  };
  return {appState, repo, bin, confirm: new FakeConfirm(answer), calls};
}

describe('Bin actions', () => {
  it('Move to Bin asks, naming the project, and does nothing on Cancel', async () => {
    const h = harness(false, {openId: 'p-1'});
    expect(await moveToBin(h.appState, h.repo, h.bin, h.confirm, 'p-1', 'Sub 12')).toBe('cancelled');
    expect(h.confirm.asked[0]?.message).toBe('Move "Sub 12" to the Bin? You can restore it from the Bin on any device.');
    expect(h.calls).toEqual([]);
  });

  it('Move to Bin of an open project with unsaved edits saves them, bins it, then closes it', async () => {
    const h = harness(true, {openId: 'p-1', unsaved: true});
    expect(await moveToBin(h.appState, h.repo, h.bin, h.confirm, 'p-1', 'Sub 12')).toBe('done');
    expect(h.calls).toEqual(['save', 'bin p-1', 'close 1']);
  });

  it('a project that is not open is binned and nothing closes', async () => {
    const h = harness(true);
    expect(await moveToBin(h.appState, h.repo, h.bin, h.confirm, 'p-1', 'Sub 12')).toBe('done');
    expect(h.calls).toEqual(['bin p-1']);
  });

  it('an open project stays open when the Bin refuses', async () => {
    const h = harness(true, {openId: 'p-1', binResult: 'refused'});
    expect(await moveToBin(h.appState, h.repo, h.bin, h.confirm, 'p-1', 'Sub 12')).toBe('refused');
    expect(h.calls).toEqual(['bin p-1']);
  });

  it('Delete forever and Empty Bin ask first, saying the backup is taken', async () => {
    const h = harness(true);
    expect(await deleteForever(h.bin, h.confirm, 'p-1', 'Sub 12')).toBe('done');
    expect(await emptyBin(h.bin, h.confirm, 3, '12 KB')).toBe('done');
    expect(h.confirm.asked.map(r => r.message)).toEqual([
      'Delete "Sub 12" forever? It is removed from this browser and from Drive on every synced device. A backup is taken first.',
      'Delete 3 projects in the Bin (12 KB) forever? They are removed from this browser and from Drive on every synced device. A backup is taken first.',
    ]);
    expect(h.calls).toEqual(['forever p-1', 'empty']);
  });
});
