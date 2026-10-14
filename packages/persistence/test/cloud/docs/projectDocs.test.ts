import { describe, expect, it } from 'vitest';
import { DeviceId } from '@openisd/design/cloud';
import { createEngine } from '@openisd/design/engine';
import { createProjectDocs } from '../../../src/cloud/docs/projectDocs.js';
import { OPENISD_PROJECTS_KEY } from '../../../src/repos/storageKeys.js';
import { createMemoryStorage } from '../../../src/storage/keyValueStorage.js';
import { goodProjectText } from '../../fixtures/projectTexts.js';
import { createQuotaStorage } from '../../fixtures/quotaStorage.js';
import type { LayoutRules } from '../../../src/repos/layoutMigration.js';
import { LAYOUT_STEPS } from '../../../src/repos/layoutSteps.js';
import { projectRepoOn } from '../../fixtures/repoOn.js';
import type { FileStorage } from '../../../src/storage/fileStorage.js';

const engine = createEngine();
const noFiles: FileStorage = {
  save: () => { throw new Error('no file is written here'); },
  saveAs: () => { throw new Error('no file is written here'); },
  openFileName: () => null,
  forget: () => { throw new Error('no file is written here'); },
};

const FIXED_NOW = new Date(2026, 9, 13, 21, 5, 0).getTime();
const RULES: LayoutRules = { layout: 2, steps: LAYOUT_STEPS };

function setup(initialData: Record<string, string> = {}) {
  const storage = createMemoryStorage(initialData);
  const repo = projectRepoOn(engine, noFiles, storage, 'http://localhost');
  const bucket = createProjectDocs({ repo, rules: RULES, now: () => FIXED_NOW });
  return { storage, repo, bucket };
}

describe('projectDocs', () => {
  it('lists stored projects with layout and body', () => {
    const text = goodProjectText('Sub 12');
    const { bucket } = setup({
      [OPENISD_PROJECTS_KEY]: JSON.stringify({
        entries: [{ id: 'p-1', text, modified: '2026-01-01T00:00:00Z' }],
      }),
    });
    const read = bucket.list();
    expect(read.kind).toBe('ok');
    if (read.kind !== 'ok') return;
    expect(read.docs).toHaveLength(1);
    expect(read.docs[0]).toEqual({
      id: { kind: 'project', uuid: 'p-1' },
      body: text,
      layout: 2,
    });
  });

  it('lists unreadable when store text is corrupt JSON', () => {
    const { bucket } = setup({
      [OPENISD_PROJECTS_KEY]: 'corrupt-not-json',
    });
    const read = bucket.list();
    expect(read.kind).toBe('unreadable');
  });

  it('lists unreadable when store shape is invalid', () => {
    const { bucket } = setup({
      [OPENISD_PROJECTS_KEY]: JSON.stringify({ wrong: true }),
    });
    const read = bucket.list();
    expect(read.kind).toBe('unreadable');
  });

  it('writes by id, resolving clashing names with uniqueName ("Sub 12 (2)")', () => {
    const textA = goodProjectText('Sub 12');
    const textB = goodProjectText('Sub 12');
    const { bucket } = setup({
      [OPENISD_PROJECTS_KEY]: JSON.stringify({
        entries: [{ id: 'p-local', text: textA, modified: '2026-01-01T00:00:00Z' }],
      }),
    });

    const putRes = bucket.put({
      id: { kind: 'project', uuid: 'p-remote' },
      body: textB,
      layout: 2,
    });
    expect(putRes).toBe('done');

    const read = bucket.list();
    expect(read.kind).toBe('ok');
    if (read.kind !== 'ok') return;
    expect(read.docs).toHaveLength(2);

    const docLocal = read.docs.find(d => d.id.kind === 'project' && d.id.uuid === 'p-local');
    const docRemote = read.docs.find(d => d.id.kind === 'project' && d.id.uuid === 'p-remote');
    expect(docLocal).toBeDefined();
    expect(docRemote).toBeDefined();

    const parsedRemote: unknown = JSON.parse(docRemote?.body ?? '{}');
    expect(parsedRemote).toMatchObject({ label: 'Sub 12 (2)' });
  });

  it('replacing put updates the same project by id and guards destructive write', () => {
    const originalText = goodProjectText('Sub 12');
    const updatedText = goodProjectText('Sub 12 Updated');
    const { bucket, storage } = setup({
      [OPENISD_PROJECTS_KEY]: JSON.stringify({
        entries: [{ id: 'p-1', text: originalText, modified: '2026-01-01T00:00:00Z' }],
      }),
    });

    const putRes = bucket.put({
      id: { kind: 'project', uuid: 'p-1' },
      body: updatedText,
      layout: 2,
    });
    expect(putRes).toBe('done');

    const read = bucket.list();
    expect(read.kind).toBe('ok');
    if (read.kind !== 'ok') return;
    expect(read.docs).toHaveLength(1);
    expect(read.docs[0].id).toEqual({ kind: 'project', uuid: 'p-1' });

    // Verify backup was made because it was replacing
    const hasBackup = storage.keys().some(k => k.startsWith('openisd_backup_'));
    expect(hasBackup).toBe(true);
  });

  it('replacing put is refused when backup fails due to quota', () => {
    const text = goodProjectText('Sub 12');
    const seed = {
      [OPENISD_PROJECTS_KEY]: JSON.stringify({
        entries: [{ id: 'p-1', text, modified: '2026-01-01T00:00:00Z' }],
      }),
    };
    const storage = createQuotaStorage(JSON.stringify(seed).length + 20, seed);
    const repo = projectRepoOn(engine, noFiles, storage, 'http://localhost');
    const bucket = createProjectDocs({ repo, rules: RULES, now: () => FIXED_NOW });

    const putRes = bucket.put({
      id: { kind: 'project', uuid: 'p-1' },
      body: goodProjectText('Sub 12 Modified'),
      layout: 2,
    });
    expect(putRes).toBe('refused');
    expect(storage.get(OPENISD_PROJECTS_KEY)).toBe(seed[OPENISD_PROJECTS_KEY]);
  });

  it('removes a project by id through backup.guard', () => {
    const text = goodProjectText('Sub 12');
    const { bucket, storage } = setup({
      [OPENISD_PROJECTS_KEY]: JSON.stringify({
        entries: [{ id: 'p-1', text, modified: '2026-01-01T00:00:00Z' }],
      }),
    });

    const remRes = bucket.remove({ kind: 'project', uuid: 'p-1' });
    expect(remRes).toBe('done');

    const read = bucket.list();
    expect(read.kind).toBe('ok');
    if (read.kind !== 'ok') return;
    expect(read.docs).toHaveLength(0);

    const hasBackup = storage.keys().some(k => k.startsWith('openisd_backup_'));
    expect(hasBackup).toBe(true);
  });

  it('migrates a layout-1 body through layout steps', () => {
    const { bucket } = setup();
    const text = goodProjectText('Sub 12');
    const migrated = bucket.migrate({
      id: { kind: 'project', uuid: 'p-1' },
      body: text,
      layout: 1,
    });
    expect(migrated).toBe(text);
  });

  it('returns null (held) for a newer layout body', () => {
    const { bucket } = setup();
    const text = goodProjectText('Sub 12');
    const held = bucket.migrate({
      id: { kind: 'project', uuid: 'p-1' },
      body: text,
      layout: 3,
    });
    expect(held).toBeNull();
  });

  it('putConflictCopy creates a new uuid and conflict name mark', () => {
    const text = goodProjectText('Sub 12');
    const { bucket } = setup({
      [OPENISD_PROJECTS_KEY]: JSON.stringify({
        entries: [{ id: 'p-1', text, modified: '2026-01-01T00:00:00Z' }],
      }),
    });

    const device = DeviceId.of('phone');
    expect(device).not.toBeNull();
    if (device === null) return;

    const copyRes = bucket.putConflictCopy(
      { id: { kind: 'project', uuid: 'p-1' }, body: text, layout: 2 },
      device,
      FIXED_NOW,
    );
    expect(copyRes).not.toBe('refused');
    if (copyRes === 'refused') return;
    const copyId = copyRes.id;
    expect(copyId.kind).toBe('project');
    if (copyId.kind !== 'project') return;
    const newUuid = copyId.uuid;
    expect(newUuid).not.toBe('p-1');

    const read = bucket.list();
    expect(read.kind).toBe('ok');
    if (read.kind !== 'ok') return;
    expect(read.docs).toHaveLength(2);

    const copyDoc = read.docs.find(d => {
      const { id } = d;
      return id.kind === 'project' && id.uuid === newUuid;
    });
    expect(copyDoc).toBeDefined();
    const parsed: unknown = JSON.parse(copyDoc?.body ?? '{}');
    expect(parsed).toMatchObject({
      label: 'Sub 12 (conflict, phone, 13 Oct 2026, 21:05)',
    });
  });
});
