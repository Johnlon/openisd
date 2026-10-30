import { describe, expect, it } from 'vitest';
import {createEngine} from '@openisd/design/engine';
import { DeviceName } from '@openisd/design/cloud';
const ANDROID_PHONE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';

import { createSavedEntryDocs } from '../../../src/cloud/docs/savedEntryDocs.js';
import { OPENISD_MY_DRIVERS_KEY, OPENISD_MY_PASSIVE_RADIATORS_KEY } from '../../../src/repos/storageKeys.js';
import { createMemoryStorage } from '../../../src/storage/keyValueStorage.js';
import { createStorageBackup } from '../../../src/repos/storageBackup.js';
import { createSavedEntries } from '../../../src/repos/savedEntries.js';
import { createQuotaStorage } from '../../fixtures/quotaStorage.js';
import type { LayoutRules } from '../../../src/repos/layoutMigration.js';
import { layoutStepsOn } from '../../../src/repos/layoutSteps.js';

const FIXED_NOW = new Date(2026, 9, 13, 21, 5, 0).getTime();
const RULES: LayoutRules = { layout: 2, steps: layoutStepsOn(createEngine()) };

function setupDriver(initialData: Record<string, string> = {}) {
  const storage = createMemoryStorage(initialData);
  const backup = createStorageBackup(storage, () => FIXED_NOW);
  const entries = createSavedEntries<unknown>(
    storage,
    { key: OPENISD_MY_DRIVERS_KEY, open: r => r, snapshot: v => v },
    backup,
  );
  const bucket = createSavedEntryDocs({ repo: entries, rules: RULES, now: () => FIXED_NOW });
  return { storage, backup, entries, bucket };
}

function setupPr(initialData: Record<string, string> = {}) {
  const storage = createMemoryStorage(initialData);
  const backup = createStorageBackup(storage, () => FIXED_NOW);
  const entries = createSavedEntries<unknown>(
    storage,
    { key: OPENISD_MY_PASSIVE_RADIATORS_KEY, open: r => r, snapshot: v => v },
    backup,
  );
  const bucket = createSavedEntryDocs({ repo: entries, rules: RULES, now: () => FIXED_NOW });
  return { storage, backup, entries, bucket };
}

describe('savedEntryDocs', () => {
  describe('driver bucket', () => {
    it('lists stored drivers with layout and body', () => {
      const record = { brand: 'Scan-Speak', model: '18W' };
      const { bucket } = setupDriver({
        [OPENISD_MY_DRIVERS_KEY]: JSON.stringify({
          entries: [{ uuid: 'd-1', record }],
        }),
      });
      const read = bucket.list();
      expect(read.kind).toBe('ok');
      if (read.kind !== 'ok') return;
      expect(read.docs).toHaveLength(1);
      expect(read.docs[0].id).toEqual({ kind: 'driver', uuid: 'd-1' });
      expect(JSON.parse(read.docs[0].body)).toEqual(record);
      expect(read.docs[0].layout).toBe(2);
    });

    it('lists unreadable when store text is corrupt JSON', () => {
      const { bucket } = setupDriver({
        [OPENISD_MY_DRIVERS_KEY]: 'corrupt-not-json',
      });
      const read = bucket.list();
      expect(read.kind).toBe('unreadable');
    });

    it('puts a new driver by id', () => {
      const { bucket } = setupDriver();
      const res = bucket.put({
        id: { kind: 'driver', uuid: 'd-new' },
        body: JSON.stringify({ brand: 'Peerless', model: 'XXLS' }),
        layout: 2,
      }, '');
      expect(res).toBe('done');
      const read = bucket.list();
      expect(read.kind).toBe('ok');
      if (read.kind !== 'ok') return;
      expect(read.docs).toHaveLength(1);
      expect(read.docs[0].id).toEqual({ kind: 'driver', uuid: 'd-new' });
    });

    it('replacing put updates the driver in place and guards destructive write', () => {
      const { bucket, storage } = setupDriver({
        [OPENISD_MY_DRIVERS_KEY]: JSON.stringify({
          entries: [{ uuid: 'd-1', record: { brand: 'Old' } }],
        }),
      });
      const res = bucket.put({
        id: { kind: 'driver', uuid: 'd-1' },
        body: JSON.stringify({ brand: 'New' }),
        layout: 2,
      }, '');
      expect(res).toBe('done');
      const read = bucket.list();
      expect(read.kind).toBe('ok');
      if (read.kind !== 'ok') return;
      expect(read.docs).toHaveLength(1);
      expect(JSON.parse(read.docs[0].body)).toEqual({ brand: 'New' });

      const hasBackup = storage.keys().some(k => k.startsWith('openisd_backup_'));
      expect(hasBackup).toBe(true);
    });

    it('replacing put is refused when backup fails due to quota', () => {
      const seed = {
        [OPENISD_MY_DRIVERS_KEY]: JSON.stringify({
          entries: [{ uuid: 'd-1', record: { brand: 'Old' } }],
        }),
      };
      const storage = createQuotaStorage(JSON.stringify(seed).length + 20, seed);
      const backup = createStorageBackup(storage, () => FIXED_NOW);
      const entries = createSavedEntries<unknown>(
        storage,
        { key: OPENISD_MY_DRIVERS_KEY, open: r => r, snapshot: v => v },
        backup,
      );
      const bucket = createSavedEntryDocs({ repo: entries, rules: RULES, now: () => FIXED_NOW });

      const res = bucket.put({
        id: { kind: 'driver', uuid: 'd-1' },
        body: JSON.stringify({ brand: 'New' }),
        layout: 2,
      }, '');
      expect(res).toBe('refused');
      expect(storage.get(OPENISD_MY_DRIVERS_KEY)).toBe(seed[OPENISD_MY_DRIVERS_KEY]);
    });

    it('removes a driver by id through backup.guard', () => {
      const { bucket, storage } = setupDriver({
        [OPENISD_MY_DRIVERS_KEY]: JSON.stringify({
          entries: [{ uuid: 'd-1', record: { brand: 'Old' } }],
        }),
      });
      const res = bucket.remove({ kind: 'driver', uuid: 'd-1' });
      expect(res).toBe('done');
      const read = bucket.list();
      expect(read.kind).toBe('ok');
      if (read.kind !== 'ok') return;
      expect(read.docs).toHaveLength(0);

      const hasBackup = storage.keys().some(k => k.startsWith('openisd_backup_'));
      expect(hasBackup).toBe(true);
    });

    it('putConflictCopy keeps the copy under a new uuid, its model marked as the conflict copy', () => {
      const record = { brand: 'Peerless', model: 'XXLS' };
      const { bucket } = setupDriver({
        [OPENISD_MY_DRIVERS_KEY]: JSON.stringify({
          entries: [{ uuid: 'd-1', record }],
        }),
      });
      const device = DeviceName.ofBrowser(ANDROID_PHONE_UA, 5);

      const copyRes = bucket.putConflictCopy(
        { id: { kind: 'driver', uuid: 'd-1' }, body: JSON.stringify(record), layout: 2 },
        device,
        FIXED_NOW,
      );
      expect(copyRes).not.toBe('refused');
      if (copyRes === 'refused') return;
      const copyId = copyRes.id;
      expect(copyId.kind).toBe('driver');
      if (copyId.kind !== 'driver') return;
      const newUuid = copyId.uuid;
      expect(newUuid).not.toBe('d-1');

      const read = bucket.list();
      expect(read.kind).toBe('ok');
      if (read.kind !== 'ok') return;
      expect(read.docs).toHaveLength(2);

      const copyDoc = read.docs.find(d => {
        const { id } = d;
        return id.kind === 'driver' && id.uuid === newUuid;
      });
      expect(copyDoc).toBeDefined();
      const marked = 'XXLS (conflict, 13 Oct 2026, Android phone)';
      expect(JSON.parse(copyDoc?.body ?? '{}')).toEqual({ ...record, model: marked });
      expect(copyRes.item).toBe('XXLS');
      expect(copyRes.name).toBe(marked);
      expect(copyRes.body).toBe(copyDoc?.body);
      const original = read.docs.find(d => d.id.kind === 'driver' && d.id.uuid === 'd-1');
      expect(JSON.parse(original?.body ?? '{}')).toEqual(record);
    });

    it('migrates a layout-1 driver body through layout steps', () => {
      const { bucket } = setupDriver();
      const body = '{"brand":"Peerless"}';
      const migrated = bucket.migrate({
        id: { kind: 'driver', uuid: 'd-1' },
        body,
        layout: 1,
      });
      expect(JSON.parse(migrated ?? '{}')).toEqual({ brand: 'Peerless' });
    });
  });

  describe('pr bucket', () => {
    it('lists and puts saved passive radiators', () => {
      const record = { brand: 'Dayton', model: 'RSS390-PR' };
      const { bucket } = setupPr({
        [OPENISD_MY_PASSIVE_RADIATORS_KEY]: JSON.stringify({
          entries: [{ uuid: 'pr-1', record }],
        }),
      });
      const read = bucket.list();
      expect(read.kind).toBe('ok');
      if (read.kind !== 'ok') return;
      expect(read.docs).toHaveLength(1);
      expect(read.docs[0].id).toEqual({ kind: 'pr', uuid: 'pr-1' });
    });

    it('putConflictCopy marks a passive radiator copy the same way', () => {
      const record = { brand: { value: 'Dayton' }, model: { value: 'RSS390-PR' } };
      const { bucket } = setupPr({
        [OPENISD_MY_PASSIVE_RADIATORS_KEY]: JSON.stringify({ entries: [{ uuid: 'pr-1', record }] }),
      });
      const copyRes = bucket.putConflictCopy(
        { id: { kind: 'pr', uuid: 'pr-1' }, body: JSON.stringify(record), layout: 2 },
        DeviceName.ofBrowser(ANDROID_PHONE_UA, 5),
        FIXED_NOW,
      );
      expect(copyRes).not.toBe('refused');
      if (copyRes === 'refused') return;
      expect(copyRes.item).toBe('RSS390-PR');
      expect(copyRes.name).toBe('RSS390-PR (conflict, 13 Oct 2026, Android phone)');
      expect(JSON.parse(copyRes.body)).toEqual({ ...record, model: { value: 'RSS390-PR (conflict, 13 Oct 2026, Android phone)' } });
    });
  });
});
