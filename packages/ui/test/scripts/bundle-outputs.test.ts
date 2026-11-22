import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {applyBundleOutputs, filesForSelectedPaths, onlyRecordPathsFromArgs} from '../../../../scripts/bundleOutputs.mjs';

describe('narrow bundled catalogue refresh', () => {
  it('parses repeated exact record selectors and rejects unsafe paths', () => {
    assert.deepEqual(
      [...onlyRecordPathsFromArgs(['--only-record', 'eminence/sigma-pro-18a', '--only-record', 'faitalpro/12pr300-8'])],
      ['eminence/sigma-pro-18a', 'faitalpro/12pr300-8'],
    );
    assert.throws(() => onlyRecordPathsFromArgs(['--only-record', '../escape/model']), /brand\/sku/);
    assert.throws(() => onlyRecordPathsFromArgs(['--only-record', 'brand/model/extra']), /brand\/sku/);
  });

  it('selects only requested corpus record files and reports absent paths', () => {
    const files = ['corpus/brand/one/openisd.json', 'corpus/brand/two/openisd.json'];
    const pathOf = (file: string): string => file.split('/').slice(1, 3).join('/');
    assert.deepEqual(filesForSelectedPaths(files, new Set(['brand/two']), pathOf), [files[1]]);
    assert.throws(() => filesForSelectedPaths(files, new Set(['brand/missing']), pathOf), /not found in corpus/);
  });

  it('rewrites only selected records, merges selected rows into both indexes, and invalidates the full stamp', () => {
    const root = mkdtempSync(join(tmpdir(), 'bundle-selected-records-'));
    try {
      const publicRoot = join(root, 'packages', 'ui', 'public');
      const recordsRoot = join(publicRoot, 'drivers');
      const stampFile = join(root, 'build', 'drivers-bundle.stamp');
      const selectedPath = 'eminence/sigma-pro-18a';
      const untouchedPath = 'dayton-audio/nd140-8';
      const selectedFile = join(recordsRoot, `${selectedPath}.json`);
      const untouchedFile = join(recordsRoot, `${untouchedPath}.json`);
      mkdirSync(join(recordsRoot, 'eminence'), {recursive: true});
      mkdirSync(join(recordsRoot, 'dayton-audio'), {recursive: true});
      mkdirSync(join(root, 'build'), {recursive: true});
      writeFileSync(selectedFile, '{"version":"old"}');
      writeFileSync(untouchedFile, '{ "keep": true }');
      writeFileSync(join(publicRoot, 'drivers-index.json'), JSON.stringify([
        {path: selectedPath, version: 'old'},
        {path: untouchedPath, version: 'keep'},
      ]));
      writeFileSync(join(publicRoot, 'passive-radiators-index.json'), JSON.stringify([
        {path: 'dayton-audio/nd140-pr', version: 'keep'},
      ]));
      writeFileSync(stampFile, 'old-fingerprint\n');

      applyBundleOutputs({
        publicRoot,
        stampFile,
        records: [
          {path: selectedPath, record: {version: 'new'}},
          {path: untouchedPath, record: {keep: true}},
        ],
        driverRows: [{path: selectedPath}],
        radiatorRows: [],
        selectedPaths: new Set([selectedPath]),
        fingerprint: 'new-fingerprint',
      });

      assert.deepEqual(JSON.parse(readFileSync(selectedFile, 'utf8')), {version: 'new'});
      assert.equal(readFileSync(untouchedFile, 'utf8'), '{ "keep": true }', 'unselected record bytes are untouched');
      assert.deepEqual(JSON.parse(readFileSync(join(publicRoot, 'drivers-index.json'), 'utf8')),
        [{path: selectedPath}, {path: untouchedPath, version: 'keep'}], 'driver index updates only the selected row');
      assert.deepEqual(JSON.parse(readFileSync(join(publicRoot, 'passive-radiators-index.json'), 'utf8')),
        [{path: 'dayton-audio/nd140-pr', version: 'keep'}], 'radiator index leaves the full catalogue intact');
      assert.equal(existsSync(stampFile), false, 'partial refresh forces the next full run to recompute');
    } finally {
      rmSync(root, {recursive: true, force: true});
    }
  });

  it('validates every selected path before writing anything', () => {
    const root = mkdtempSync(join(tmpdir(), 'bundle-selected-missing-'));
    try {
      const publicRoot = join(root, 'packages', 'ui', 'public');
      const existingIndex = join(publicRoot, 'drivers-index.json');
      mkdirSync(publicRoot, {recursive: true});
      writeFileSync(existingIndex, '[{"old":true}]');

      assert.throws(() => applyBundleOutputs({
        publicRoot,
        stampFile: join(root, 'build', 'drivers-bundle.stamp'),
        records: [{path: 'brand/known', record: {value: 1}}],
        driverRows: [{path: 'brand/known'}],
        radiatorRows: [],
        selectedPaths: new Set(['brand/missing']),
        fingerprint: 'fingerprint',
      }), /not in the validated bundle records/);
      assert.equal(readFileSync(existingIndex, 'utf8'), '[{"old":true}]');
    } finally {
      rmSync(root, {recursive: true, force: true});
    }
  });
});
