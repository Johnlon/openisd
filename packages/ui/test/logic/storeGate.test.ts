import {describe, expect, it, vi} from 'vitest';
import {
  createBuildStamp, createMemoryStorage, createStoreOpening, LAYOUT_STEPS, STORAGE_LAYOUT, OPENISD_BACKUP_PREFIX, OPENISD_PROJECTS_KEY,
  OPENISD_STORAGE_LAYOUT_KEY, type OpenStore, type StoreOpening,
} from '@openisd/persistence';
import {createStoreGateSession} from '../../src/logic/storeGate.js';

const BUILD = createBuildStamp('v20260301T040506Z');
const NOW = Date.UTC(2026, 2, 1, 4, 5, 6);
const BACKUP_KEY = `${OPENISD_BACKUP_PREFIX}v20260101T0000Z`;

function blockedOpening() {
  const storage = createMemoryStorage({
    [OPENISD_PROJECTS_KEY]: 'projects from the future', [OPENISD_STORAGE_LAYOUT_KEY]: String(STORAGE_LAYOUT + 1),
    [BACKUP_KEY]: JSON.stringify({
      openisdBackup: true, layout: STORAGE_LAYOUT, build: 'v20260101T0000Z', exportedAt: '20260101T000000Z',
      data: {[OPENISD_PROJECTS_KEY]: 'old projects'},
    }),
  });
  const opening: StoreOpening = createStoreOpening(storage, {
    build: BUILD, now: () => NOW, rules: {layout: STORAGE_LAYOUT, steps: LAYOUT_STEPS}, memoryStorage: createMemoryStorage,
  });
  if (opening.kind === 'ready') throw new Error('expected the newer store to be refused');
  return {storage, opening};
}

function session(opening: Exclude<StoreOpening, {kind: 'ready'}>) {
  const download = vi.fn();
  const onReady = vi.fn<(open: OpenStore) => void>();
  const gate = createStoreGateSession(opening, {formatTime: at => at.toISOString(), download, now: () => NOW, onReady});
  return {gate, download, onReady};
}

describe('the store gate screen', () => {
  it('tells the user the data is newer, that nothing changed, and lists the backups this version reads', () => {
    const {gate} = session(blockedOpening().opening);
    const screen = gate.screen.value;
    expect(screen.title).toBe('This browser holds data from a newer OpenISD');
    expect(screen.message).toContain(`layout ${STORAGE_LAYOUT + 1}`);
    expect(screen.message).toContain('Nothing has been changed');
    expect(screen.backups).toEqual([{key: BACKUP_KEY, label: `Backup of 2026-01-01T00:00:00.000Z (layout ${STORAGE_LAYOUT})`}]);
  });

  it('offers a raw export of everything, named with a basic UTC time', () => {
    const {gate, download} = session(blockedOpening().opening);
    gate.exportEverything();
    expect(download).toHaveBeenCalledTimes(1);
    expect(download.mock.calls[0][0]).toBe('openisd-everything-20260301T040506Z.json');
    expect(download.mock.calls[0][1]).toContain('projects from the future');
  });

  it('restoring a backup opens the app on the restored store', () => {
    const {storage, opening} = blockedOpening();
    const {gate, onReady} = session(opening);
    gate.restore(BACKUP_KEY);
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(storage.get(OPENISD_PROJECTS_KEY)).toBe('old projects');
  });

  it('opening a backup read-only starts the app without touching the live store', () => {
    const {storage, opening} = blockedOpening();
    const {gate, onReady} = session(opening);
    gate.readOnly(BACKUP_KEY);
    expect(onReady.mock.calls[0][0].readOnly).toBe(true);
    expect(storage.get(OPENISD_PROJECTS_KEY)).toBe('projects from the future');
  });

  it('says so, and stays, when the backup cannot be used', () => {
    const {opening} = blockedOpening();
    const {gate, onReady} = session(opening);
    gate.readOnly(`${OPENISD_BACKUP_PREFIX}vmissing`);
    expect(onReady).not.toHaveBeenCalled();
    expect(gate.screen.value.message).toContain('That backup could not be opened.');
  });
});
