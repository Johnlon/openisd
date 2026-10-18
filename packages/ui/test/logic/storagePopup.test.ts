import {describe, expect, it, vi} from 'vitest';
import {ref} from 'vue';
import {createBrowserStoragePort, createMemoryStorage, createPersistenceStatus, createSaveSignal, type BrowserStoragePort} from '@openisd/persistence';
import type {ConfirmRequest} from '../../src/logic/confirmPort.js';
import {showStoragePopup} from '../../src/logic/storagePopup.js';

const mb = 1024 * 1024;

function setup(options: {outcome: 'granted' | 'refused'; localBytes: number; seen?: string}) {
  const storage = createMemoryStorage(options.seen === undefined ? {} : {openisd_persist_warning_dismissed: options.seen});
  const port: BrowserStoragePort = {
    ...createBrowserStoragePort(undefined, 'Firefox'),
    persist: () => Promise.resolve(options.outcome),
  };
  const persistence = createPersistenceStatus(port, storage);
  const asked: ConfirmRequest[] = [];
  const splashOpen = ref(false);
  const saves = createSaveSignal();
  const held = {localBytes: options.localBytes};
  const run = () => showStoragePopup({
    persistence,
    browserStorage: port,
    readUse: () => ({projectCount: 3, localBytes: held.localBytes}),
    saves,
    confirm: {ask(request) { asked.push(request); return Promise.resolve(true); }},
    splashOpen,
  });
  return {asked, run, splashOpen, persistence, saves, held};
}

describe('showStoragePopup', () => {
  it('shows nothing when the browser keeps the data and storage is not near full', async () => {
    const s = setup({outcome: 'granted', localBytes: mb});
    await s.run();
    expect(s.asked).toEqual([]);
  });

  it('shows the risk with only a Close button, and remembers it was closed', async () => {
    const s = setup({outcome: 'refused', localBytes: mb});
    await s.run();
    expect(s.asked).toHaveLength(1);
    expect(s.asked[0]?.title).toBe('Your projects may not be kept');
    expect(s.asked[0]?.message).toContain("Firefox has not promised to keep this site's data");
    expect(s.asked[0]?.confirmLabel).toBe('Close');
    expect(s.asked[0]?.cancelLabel).toBeUndefined();
    expect(s.persistence.acknowledgedRisk()).toBe('refused:Firefox');
  });

  it('does not show a risk that was closed before', async () => {
    const s = setup({outcome: 'refused', localBytes: mb, seen: 'refused:Firefox'});
    await s.run();
    expect(s.asked).toEqual([]);
  });

  it('shows nearly full at every start and does not mark the risk closed', async () => {
    const s = setup({outcome: 'granted', localBytes: 4.3 * mb, seen: 'refused:Firefox'});
    await s.run();
    expect(s.asked).toHaveLength(1);
    expect(s.asked[0]?.title).toBe('Storage is nearly full');
    expect(s.persistence.acknowledgedRisk()).toBe('refused:Firefox');
  });

  it('replaces a closed-banner mark with the condition seen now, without showing the popup', async () => {
    const s = setup({outcome: 'granted', localBytes: mb, seen: '1'});
    await s.run();
    expect(s.asked).toEqual([]);
    expect(s.persistence.acknowledgedRisk()).toBe('granted:Firefox');
  });

  it('waits until the splash is closed', async () => {
    const s = setup({outcome: 'refused', localBytes: mb});
    s.splashOpen.value = true;
    const done = s.run();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(s.asked).toEqual([]);
    s.splashOpen.value = false;
    await done;
    expect(s.asked).toHaveLength(1);
  });

  it('shows nearly full once when a save takes storage across 80%, and again at the next crossing', async () => {
    const s = setup({outcome: 'granted', localBytes: mb});
    await s.run();
    s.held.localBytes = 4.3 * mb;
    s.saves.notify();
    await vi.waitFor(() => expect(s.asked).toHaveLength(1));
    expect(s.asked[0]?.title).toBe('Storage is nearly full');
    s.held.localBytes = 4.4 * mb;
    s.saves.notify();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(s.asked).toHaveLength(1);
    s.held.localBytes = mb;
    s.saves.notify();
    s.held.localBytes = 4.5 * mb;
    await new Promise(resolve => setTimeout(resolve, 20));
    s.saves.notify();
    await vi.waitFor(() => expect(s.asked).toHaveLength(2));
  });

  it('shows nothing after a save when storage was already nearly full at start', async () => {
    const s = setup({outcome: 'granted', localBytes: 4.3 * mb});
    await s.run();
    s.held.localBytes = 4.6 * mb;
    s.saves.notify();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(s.asked).toHaveLength(1);
  });
});
