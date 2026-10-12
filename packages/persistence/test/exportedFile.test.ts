import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createExportedFiles} from '../src/repos/exportedFile.js';
import type {LayoutStep} from '../src/repos/layoutMigration.js';

const steps: LayoutStep[] = [1, 2].map((from): LayoutStep => ({
  from, migrate: data => data, migrateFile: file => ({...file, path: `${String(file.path ?? '')}>${from + 1}`}),
}));
const files = createExportedFiles({layout: 3, steps});

describe('the layout stamp on an exported file', () => {
  it('puts layout first and leaves every other field and the indent alone', () => {
    const stamped = files.stamp(JSON.stringify({label: 'x', saved: {a: 1}}, null, 2));
    assert.equal(stamped, JSON.stringify({layout: 3, label: 'x', saved: {a: 1}}, null, 2));
    assert.ok(stamped.startsWith('{\n  "layout": 3,'));
  });

  it('a compact file stays compact', () => {
    assert.equal(files.stamp('{"a":1}'), '{"layout":3,"a":1}');
  });

  it('stamps over a stamp it already has', () => {
    assert.equal(files.stamp('{"layout":1,"a":1}'), '{"layout":3,"a":1}');
  });

  it('text that is not a JSON object is returned as it is', () => {
    for (const text of ['', 'not json', '[1]', '"s"']) assert.equal(files.stamp(text), text);
  });

  it('opens a file of this layout, taking the stamp off', () => {
    assert.deepEqual(files.open('{"layout":3,"a":1}'), {kind: 'ok', text: '{"a":1}'});
  });

  it('opens an older file by migrating stepwise from its layout; an unstamped file is layout 1', () => {
    assert.deepEqual(files.open('{"layout":2,"a":1}'), {kind: 'ok', text: '{"a":1,"path":">3"}'});
    assert.deepEqual(files.open('{"a":1}'), {kind: 'ok', text: '{"a":1,"path":">2>3"}'});
  });

  it('refuses a file of a newer layout, saying both layouts', () => {
    assert.deepEqual(files.open('{"layout":9,"a":1}'), {kind: 'newer', layout: 9, reads: 3});
  });

  it('hands text that is not a JSON object on, for its own reader to report', () => {
    assert.deepEqual(files.open('driver: yaml'), {kind: 'ok', text: 'driver: yaml'});
  });
});
