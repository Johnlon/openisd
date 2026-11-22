import { describe, expect, it } from 'vitest';
import { createSavedEntries } from '../src/repos/savedEntries.js';
import { OPENISD_MY_DRIVERS_KEY, OPENISD_MY_PASSIVE_RADIATORS_KEY } from '../src/repos/storageKeys.js';
import { createMemoryStorage } from '../src/storage/keyValueStorage.js';
import { createStorageBackup } from '../src/repos/storageBackup.js';

const FIXED_NOW = new Date(2026, 9, 13, 21, 5, 0).getTime();

function setupDriver(initialData: Record<string, string> = {}) {
  const storage = createMemoryStorage(initialData);
  const backup = createStorageBackup(storage, () => FIXED_NOW);
  const entries = createSavedEntries<unknown>(
    storage,
    { key: OPENISD_MY_DRIVERS_KEY, open: r => r, snapshot: v => v },
    backup,
  );
  return { storage, backup, entries };
}

function setupPr(initialData: Record<string, string> = {}) {
  const storage = createMemoryStorage(initialData);
  const backup = createStorageBackup(storage, () => FIXED_NOW);
  const entries = createSavedEntries<unknown>(
    storage,
    { key: OPENISD_MY_PASSIVE_RADIATORS_KEY, open: r => r, snapshot: v => v },
    backup,
  );
  return { storage, backup, entries };
}

describe('savedEntries', () => {
  it('determines kind from storage key', () => {
    const { entries: driverEntries } = setupDriver();
    expect(driverEntries.kind).toBe('driver');

    const { entries: prEntries } = setupPr();
    expect(prEntries.kind).toBe('pr');
  });

  it('reads empty entries when key is absent', () => {
    const { entries } = setupDriver();
    const read = entries.read();
    expect(read.kind).toBe('ok');
    if (read.kind !== 'ok') return;
    expect(read.entries).toHaveLength(0);
    expect(read.broken).toHaveLength(0);
  });

  it('reads stored entries when present', () => {
    const record = { brand: 'Scan-Speak', model: '18W' };
    const { entries } = setupDriver({
      [OPENISD_MY_DRIVERS_KEY]: JSON.stringify({
        entries: [{ uuid: 'd-1', record }],
      }),
    });
    const read = entries.read();
    expect(read.kind).toBe('ok');
    if (read.kind !== 'ok') return;
    expect(read.entries).toHaveLength(1);
    expect(read.entries[0]).toEqual({ uuid: 'd-1', value: record });
  });

  it('returns unreadable when stored JSON is invalid', () => {
    const { entries } = setupDriver({
      [OPENISD_MY_DRIVERS_KEY]: 'corrupt-not-json',
    });
    const read = entries.read();
    expect(read.kind).toBe('unreadable');
  });

  it('upsert mints fresh uuid when none provided', () => {
    const { entries } = setupDriver();
    const res = entries.upsert({ brand: 'Peerless' });
    expect(res).not.toBeNull();
    if (res === null) return;
    expect(res.overwrote).toBe(false);
    expect(res.uuid).toBeDefined();

    const read = entries.read();
    expect(read.kind).toBe('ok');
    if (read.kind !== 'ok') return;
    expect(read.entries).toHaveLength(1);
    expect(read.entries[0].uuid).toBe(res.uuid);
  });

  it('upsert overwrites existing entry by uuid and guards write with backup', () => {
    const { storage, entries } = setupDriver({
      [OPENISD_MY_DRIVERS_KEY]: JSON.stringify({
        entries: [{ uuid: 'd-1', record: { brand: 'Old' } }],
      }),
    });
    const res = entries.upsert({ brand: 'Updated' }, 'd-1');
    expect(res).toEqual({ uuid: 'd-1', overwrote: true });

    const read = entries.read();
    expect(read.kind).toBe('ok');
    if (read.kind !== 'ok') return;
    expect(read.entries).toHaveLength(1);
    expect(read.entries[0].value).toEqual({ brand: 'Updated' });

    const hasBackup = storage.keys().some(k => k.startsWith('openisd_backup_'));
    expect(hasBackup).toBe(true);
  });

  it('removeById deletes entry by uuid and guards write with backup', () => {
    const { storage, entries } = setupDriver({
      [OPENISD_MY_DRIVERS_KEY]: JSON.stringify({
        entries: [{ uuid: 'd-1', record: { brand: 'Old' } }],
      }),
    });
    const res = entries.removeById('d-1');
    expect(res).toBe('done');

    const read = entries.read();
    expect(read.kind).toBe('ok');
    if (read.kind !== 'ok') return;
    expect(read.entries).toHaveLength(0);

    const hasBackup = storage.keys().some(k => k.startsWith('openisd_backup_'));
    expect(hasBackup).toBe(true);
  });

  it('removeById refuses when uuid is absent from slots', () => {
    const { entries } = setupDriver();
    expect(entries.removeById('d-missing')).toBe('refused');
    expect(entries.removeById('')).toBe('refused');
  });
});
