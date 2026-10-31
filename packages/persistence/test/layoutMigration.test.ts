import {describe, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import assert from 'node:assert/strict';
import {STORAGE_LAYOUT} from '../src/storageLayout.js';
import {createLayoutMigrator, type LayoutStep} from '../src/repos/layoutMigration.js';
import {createLayoutSteps} from '../src/repos/layoutSteps.js';

const step = (from: number): LayoutStep => ({from, migrate: data => ({...data, k: `${data.k ?? ''}>${from + 1}`}), migrateFile: file => ({...file, k: `${String(file.k ?? '')}>${from + 1}`})});

describe('the layout migrator', () => {
  it('the app has a step for every layout below its own', () => {
    assert.equal(createLayoutMigrator({layout: STORAGE_LAYOUT, steps: createLayoutSteps(createEngine(), () => 'test-project-id')}).covers(), true);
  });

  it('migrates one layout at a time, in order, telling each layout reached', () => {
    const reached: [number, string][] = [];
    const out = createLayoutMigrator({layout: 4, steps: [step(1), step(2), step(3)]})
      .migrate({k: 'start'}, 1, (layout, data) => { reached.push([layout, data.k]); });
    assert.deepEqual(out, {k: 'start>2>3>4'});
    assert.deepEqual(reached, [[2, 'start>2'], [3, 'start>2>3'], [4, 'start>2>3>4']]);
  });

  it('starts from the layout the data is in', () => {
    assert.deepEqual(createLayoutMigrator({layout: 3, steps: [step(1), step(2)]}).migrate({k: ''}, 2), {k: '>3'});
  });

  it('data already at the current layout comes back as it is', () => {
    const data = {k: 'same'};
    assert.equal(createLayoutMigrator({layout: 3, steps: [step(1), step(2)]}).migrate(data, 3), data);
  });

  it('migrates an exported file the same way, one layout at a time', () => {
    const migrator = createLayoutMigrator({layout: 4, steps: [step(1), step(2), step(3)]});
    assert.deepEqual(migrator.migrateFile({k: 'start'}, 2), {k: 'start>3>4'});
    assert.equal(migrator.migrateFile({k: 'x'}, 4)?.k, 'x');
  });

  it('a missing step is null, and covers() says so', () => {
    const migrator = createLayoutMigrator({layout: 3, steps: [step(2)]});
    assert.equal(migrator.migrate({k: ''}, 1), null);
    assert.equal(migrator.migrateFile({k: ''}, 1), null);
    assert.equal(migrator.covers(), false);
  });
});
