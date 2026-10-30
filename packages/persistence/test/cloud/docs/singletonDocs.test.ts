import { describe, expect, it } from 'vitest';
import {createEngine} from '@openisd/design/engine';
import { DeviceName } from '@openisd/design/cloud';
const ANDROID_PHONE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36';

import { createSingletonDocs } from '../../../src/cloud/docs/singletonDocs.js';
import {
  OPENISD_APP_SETTINGS_KEY,
  OPENISD_FAVOURITE_DRIVERS_KEY,
  OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY,
} from '../../../src/repos/storageKeys.js';
import { createMemoryStorage } from '../../../src/storage/keyValueStorage.js';
import { createStorageBackup } from '../../../src/repos/storageBackup.js';
import { createQuotaStorage } from '../../fixtures/quotaStorage.js';
import { createAppSettingsRepo, createFavouritesRepo } from '../../../src/repos/appSettingsRepo.js';
import type { LayoutRules } from '../../../src/repos/layoutMigration.js';
import { layoutStepsOn } from '../../../src/repos/layoutSteps.js';

const FIXED_NOW = new Date(2026, 9, 13, 21, 5, 0).getTime();
const RULES: LayoutRules = { layout: 2, steps: layoutStepsOn(createEngine()) };

function setupSettings(initialData: Record<string, string> = {}) {
  const storage = createMemoryStorage(initialData);
  const backup = createStorageBackup(storage, () => FIXED_NOW);
  const repo = createAppSettingsRepo(storage, backup, () => undefined, () => undefined, () => undefined);
  const bucket = createSingletonDocs({ repo, rules: RULES, now: () => FIXED_NOW });
  return { storage, backup, repo, bucket };
}

function setupFavourites(initialData: Record<string, string> = {}) {
  const storage = createMemoryStorage(initialData);
  const backup = createStorageBackup(storage, () => FIXED_NOW);
  const repo = createFavouritesRepo(storage, backup);
  const bucket = createSingletonDocs({ repo, rules: RULES, now: () => FIXED_NOW });
  return { storage, backup, repo, bucket };
}

describe('singletonDocs', () => {
  describe('settings', () => {
    it('lists stored settings with layout and body', () => {
      const body = JSON.stringify({ differenceCues: true });
      const { bucket } = setupSettings({ [OPENISD_APP_SETTINGS_KEY]: body });
      const read = bucket.list();
      expect(read.kind).toBe('ok');
      if (read.kind !== 'ok') return;
      expect(read.docs).toHaveLength(1);
      expect(read.docs[0]).toEqual({
        id: { kind: 'settings' },
        body,
        layout: 2,
      });
    });

    it('lists empty docs when settings key is absent', () => {
      const { bucket } = setupSettings();
      const read = bucket.list();
      expect(read.kind).toBe('ok');
      if (read.kind !== 'ok') return;
      expect(read.docs).toHaveLength(0);
    });

    it('lists unreadable when settings text is not valid JSON', () => {
      const { bucket } = setupSettings({ [OPENISD_APP_SETTINGS_KEY]: 'corrupt-not-json' });
      const read = bucket.list();
      expect(read.kind).toBe('unreadable');
    });

    it('puts new settings when absent', () => {
      const { bucket, storage } = setupSettings();
      const body = JSON.stringify({ differenceCues: false });
      const res = bucket.put({ id: { kind: 'settings' }, body, layout: 2 }, '');
      expect(res).toBe('done');
      expect(storage.get(OPENISD_APP_SETTINGS_KEY)).toBe(body);
    });

    it('replacing put backs up store first', () => {
      const original = JSON.stringify({ differenceCues: true });
      const { bucket, storage } = setupSettings({ [OPENISD_APP_SETTINGS_KEY]: original });
      const updated = JSON.stringify({ differenceCues: false });
      const res = bucket.put({ id: { kind: 'settings' }, body: updated, layout: 2 }, '');
      expect(res).toBe('done');
      expect(storage.get(OPENISD_APP_SETTINGS_KEY)).toBe(updated);

      const hasBackup = storage.keys().some(k => k.startsWith('openisd_backup_'));
      expect(hasBackup).toBe(true);
    });

    it('replacing put is refused on quota error', () => {
      const seed = { [OPENISD_APP_SETTINGS_KEY]: JSON.stringify({ differenceCues: true }) };
      const storage = createQuotaStorage(JSON.stringify(seed).length + 20, seed);
      const backup = createStorageBackup(storage, () => FIXED_NOW);
      const repo = createAppSettingsRepo(storage, backup, () => undefined, () => undefined, () => undefined);
      const bucket = createSingletonDocs({ repo, rules: RULES, now: () => FIXED_NOW });

      const res = bucket.put({
        id: { kind: 'settings' },
        body: JSON.stringify({ differenceCues: false }),
        layout: 2,
      }, '');
      expect(res).toBe('refused');
      expect(storage.get(OPENISD_APP_SETTINGS_KEY)).toBe(seed[OPENISD_APP_SETTINGS_KEY]);
    });

    it('removes settings through backup.guard', () => {
      const { bucket, storage } = setupSettings({
        [OPENISD_APP_SETTINGS_KEY]: JSON.stringify({ differenceCues: true }),
      });
      const res = bucket.remove({ kind: 'settings' });
      expect(res).toBe('done');
      expect(storage.get(OPENISD_APP_SETTINGS_KEY)).toBeNull();
      const hasBackup = storage.keys().some(k => k.startsWith('openisd_backup_'));
      expect(hasBackup).toBe(true);
    });

    it('putConflictCopy is refused for settings', () => {
      const { bucket } = setupSettings();
      const device = DeviceName.ofBrowser(ANDROID_PHONE_UA, 5);
      const res = bucket.putConflictCopy(
        { id: { kind: 'settings' }, body: '{}', layout: 2 },
        device,
        FIXED_NOW,
      );
      expect(res).toBe('refused');
    });
  });

  describe('favourites', () => {
    it('lists stored favourites combining drivers and PRs', () => {
      const { bucket } = setupFavourites({
        [OPENISD_FAVOURITE_DRIVERS_KEY]: JSON.stringify(['d-1', 'd-2']),
        [OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY]: JSON.stringify(['pr-1']),
      });
      const read = bucket.list();
      expect(read.kind).toBe('ok');
      if (read.kind !== 'ok') return;
      expect(read.docs).toHaveLength(1);
      expect(read.docs[0].id).toEqual({ kind: 'favourites' });
      expect(JSON.parse(read.docs[0].body)).toEqual({
        drivers: ['d-1', 'd-2'],
        passiveRadiators: ['pr-1'],
      });
    });

    it('lists unreadable if either favourites key is corrupt JSON', () => {
      const { bucket } = setupFavourites({
        [OPENISD_FAVOURITE_DRIVERS_KEY]: 'corrupt',
      });
      const read = bucket.list();
      expect(read.kind).toBe('unreadable');
    });

    it('puts favourites updating both keys', () => {
      const { bucket, storage } = setupFavourites();
      const body = JSON.stringify({
        drivers: ['d-1'],
        passiveRadiators: ['pr-1', 'pr-2'],
      });
      const res = bucket.put({ id: { kind: 'favourites' }, body, layout: 2 }, '');
      expect(res).toBe('done');
      expect(JSON.parse(storage.get(OPENISD_FAVOURITE_DRIVERS_KEY) ?? '[]')).toEqual(['d-1']);
      expect(JSON.parse(storage.get(OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY) ?? '[]')).toEqual(['pr-1', 'pr-2']);
    });

    it('removes favourites clearing both keys', () => {
      const { bucket, storage } = setupFavourites({
        [OPENISD_FAVOURITE_DRIVERS_KEY]: JSON.stringify(['d-1']),
        [OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY]: JSON.stringify(['pr-1']),
      });
      const res = bucket.remove({ kind: 'favourites' });
      expect(res).toBe('done');
      expect(storage.get(OPENISD_FAVOURITE_DRIVERS_KEY)).toBeNull();
      expect(storage.get(OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY)).toBeNull();
      const hasBackup = storage.keys().some(k => k.startsWith('openisd_backup_'));
      expect(hasBackup).toBe(true);
    });
  });
});
