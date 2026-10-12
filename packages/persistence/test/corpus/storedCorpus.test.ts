/**
 * The stored-data corpus (SDLC S4): every file a user can already hold must still parse through the
 * real loaders after a schema or loader change. Run by scripts/integrate.sh when a merge touches
 * the schema, a loader or `driver_type`.
 *
 * - here: every stored-project fixture (pre-T036), through `readProjectText`, and every sample
 *   project (.wpr), through `WinIsdProjectConverter`
 * - bundledDrivers.shard*.test.ts: every bundled driver record, in four shards
 *
 * A failure names the file.
 */
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {WinIsdProjectConverter} from '@openisd/design';
import {createProjectRepo} from '../../src/repos/projectRepo.js';
import type {FileStorage} from '../../src/storage/fileStorage.js';
import {createMemoryStorage} from '../../src/storage/keyValueStorage.js';
import {ROOT, engine, filesUnder, refused} from './corpusFiles.js';

const noFiles: FileStorage = {
  save: () => { throw new Error('the corpus writes no file'); },
  saveAs: () => { throw new Error('the corpus writes no file'); },
  openFileName: () => null,
  forget: () => { throw new Error('the corpus writes no file'); },
};
const repo = createProjectRepo(engine, noFiles, createMemoryStorage(), 'http://localhost');

describe('stored-data corpus', () => {
  it('every stored-project fixture parses', () => {
    const files = filesUnder(join(ROOT, 'packages', 'persistence', 'test', 'fixtures', 'stored-pre-t036'), '.owpr');
    expect(files.length).toBeGreaterThanOrEqual(6);
    expect(refused(files, text => {
      const loaded = repo.readProjectText(text);
      return Array.isArray(loaded) ? loaded : [];
    })).toEqual([]);
  });

  it('every sample project parses', () => {
    const files = filesUnder(join(ROOT, 'docs', 'samples'), '.wpr')
      .filter(f => !f.includes('legacy_winisd_pro_alpha'));
    expect(files.length).toBeGreaterThanOrEqual(6);
    expect(refused(files, text => {
      const {value, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
      return value === null ? errors.map(e => e.message) : [];
    })).toEqual([]);
  });
});
