import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createStorageSnapshot, envelopeText, isStoreDataKey, readEnvelope, type StoreSnapshot} from '../src/repos/storageSnapshot.js';
import {STORAGE_LAYOUT} from '../src/storageLayout.js';
import {OPENISD_CLOUD_PREFIX, OPENISD_PROJECTS_KEY} from '../src/repos/storageKeys.js';
import {createMemoryStorage} from '../src/storage/keyValueStorage.js';

describe('isStoreDataKey', () => {
  it('identifies app data keys and excludes cloud, backup and log keys', () => {
    expect(isStoreDataKey(OPENISD_PROJECTS_KEY)).toBe(true);
    expect(isStoreDataKey('openisd_cloud_auth')).toBe(false);
    expect(isStoreDataKey(`${OPENISD_CLOUD_PREFIX}state`)).toBe(false);
    expect(isStoreDataKey(`${OPENISD_CLOUD_PREFIX}ledger`)).toBe(false);
    expect(isStoreDataKey('openisd_backup_v1')).toBe(false);
    expect(isStoreDataKey('openisd_storage_log')).toBe(false);
  });
});

describe('createStorageSnapshot', () => {
  it('a store holding openisd_cloud_auth and openisd_cloud_state plus a project backs up with the project and without both cloud keys', () => {
    const storage = createMemoryStorage({
      openisd_cloud_auth: 'secret-token',
      openisd_cloud_state: 'secret-state',
      [OPENISD_PROJECTS_KEY]: 'projects-payload',
    });
    const snapshot = createStorageSnapshot(storage, () => 1_000_000).take();
    expect(snapshot).not.toBeNull();
    expect(snapshot?.data).toEqual({
      [OPENISD_PROJECTS_KEY]: 'projects-payload',
    });
    expect(snapshot?.data).not.toHaveProperty('openisd_cloud_auth');
    expect(snapshot?.data).not.toHaveProperty('openisd_cloud_state');
  });
});

// --- the compressed form of a backup (T827, QO940.c4) ------------------------------------------

const realBackup: {key: string; text: string} = (() => {
  const parsed: unknown = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'stored-backup-v20261108T0032Z.json'), 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || !('key' in parsed) || typeof parsed.key !== 'string' || !('text' in parsed) || typeof parsed.text !== 'string') throw new Error('fixture');
  return {key: parsed.key, text: parsed.text};
})();

function snapshotOfReal(): StoreSnapshot {
  const read = readEnvelope(realBackup.text);
  if (read.kind !== 'ok') throw new Error('the real backup must read');
  return read.snapshot;
}

describe('a backup written by an older build (plain text, no encoding declared)', () => {
  it('reads as it always did: layout, build, time, reason and every key', () => {
    const read = readEnvelope(realBackup.text);
    expect(read.kind).toBe('ok');
    if (read.kind !== 'ok') return;
    expect(read.snapshot.layout).toBe(5);
    expect(read.snapshot.build.text).toBe('v20261108T0032Z');
    expect(read.snapshot.exportedAt).toBe('20261115T153114Z');
    expect(read.reason).toBe('startUpRewrite');
    expect(Object.keys(read.snapshot.data).length).toBeGreaterThan(0);
  });
});

function outerOf(text: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('not an object');
  return Object.fromEntries(Object.entries(parsed));
}

describe('the compressed form', () => {
  it('declares its encoding and version, and reads back exactly what was written', () => {
    const snapshot = snapshotOfReal();
    const text = envelopeText(snapshot, false, 'manual', true);
    const outer: unknown = JSON.parse(text);
    expect(outer).toMatchObject({openisdBackup: true, schemaVersion: 2, encoding: 'lz-utf16-1', dataLayout: 5, build: 'v20261108T0032Z', reason: 'manual'});
    const read = readEnvelope(text);
    expect(read).toEqual({kind: 'ok', snapshot, reason: 'manual'});
  });

  it('is at least 5 times smaller than the plain text, in stored characters', () => {
    const snapshot = snapshotOfReal();
    expect(envelopeText(snapshot, false, 'manual', true).length * 5).toBeLessThan(envelopeText(snapshot, false, 'manual').length);
  });

  it('is safe in any storage: no lone surrogate, no control character, JSON that round-trips', () => {
    const text = envelopeText(snapshotOfReal(), false, 'manual', true);
    for (let i = 0; i < text.length; i++) {
      const unit = text.charCodeAt(i);
      expect(unit >= 0xD800 && unit <= 0xDFFF, `code unit ${unit} at ${i}`).toBe(false);
      expect(unit >= 0x20, `control character ${unit} at ${i}`).toBe(true);
    }
    expect(JSON.parse(text)).toEqual(JSON.parse(JSON.stringify(JSON.parse(text))));
  });

  it('lists from its header without unpacking: layout, build, time and reason', () => {
    const text = envelopeText(snapshotOfReal(), false, 'manual', true);
    const header = readEnvelope(text, {headerOnly: true});
    expect(header).toMatchObject({kind: 'ok', reason: 'manual'});
    if (header.kind === 'ok') {
      expect(header.snapshot.layout).toBe(5);
      expect(header.snapshot.exportedAt).toBe('20261115T153114Z');
      expect(header.snapshot.data).toEqual({});
    }
  });

  it('is damaged, never restored as garbage, when the packed text is cut or altered', () => {
    const text = envelopeText(snapshotOfReal(), false, 'manual', true);
    const outer = outerOf(text);
    const whole = String(outer.packed);
    for (const packed of [whole.slice(0, whole.length / 2), 'not packed text at all', '', whole.slice(10)]) {
      const read = readEnvelope(JSON.stringify({...outer, packed}));
      expect(read.kind, packed.slice(0, 12)).toBe('invalid');
      if (read.kind === 'invalid') expect(read.reason).toMatch(/damaged/);
    }
  });

  it('is refused with a clear message, its layout still stated, when the encoding is one this build does not know', () => {
    const outer = outerOf(envelopeText(snapshotOfReal(), false, 'manual', true));
    const read = readEnvelope(JSON.stringify({...outer, encoding: 'zstd-9'}));
    expect(read).toMatchObject({kind: 'invalid', layout: outer.layout});
    if (read.kind === 'invalid') expect(read.reason).toMatch(/zstd-9.*newer OpenISD/);
  });

  it('reads, to a build that knows no encodings, as a backup of a layout it cannot read, holding no data to restore', () => {
    const outer = outerOf(envelopeText(snapshotOfReal(), false, 'manual', true));
    expect(outer.openisdBackup).toBe(true);
    expect(Number(outer.layout)).toBeGreaterThan(STORAGE_LAYOUT);
    expect(outer.data).toEqual({});
  });
});
