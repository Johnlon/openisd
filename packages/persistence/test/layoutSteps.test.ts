import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '@openisd/design/engine';
import {createLayoutSteps} from '../src/repos/layoutSteps.js';
import {OPENISD_OPEN_SESSIONS_KEY, OPENISD_QUARANTINE_SESSION_KEY, OPENISD_STATE_KEY} from '../src/repos/storageKeys.js';
import {goldenText} from './fixtures/goldens.js';

function layoutTwoAutosave(): string {
  const dump: unknown = JSON.parse(goldenText('one-project', 'dump-layout-2.json'));
  assert.ok(typeof dump === 'object' && dump !== null);
  const text: unknown = Object.entries(dump).find(([key]) => key === OPENISD_STATE_KEY)?.[1];
  assert.ok(typeof text === 'string');
  return text;
}

function projectIdOf(text: string | undefined): unknown {
  assert.ok(text !== undefined);
  const parsed: unknown = JSON.parse(text);
  assert.ok(typeof parsed === 'object' && parsed !== null);
  return Object.entries(parsed).find(([key]) => key === 'id')?.[1];
}

describe('layout step 2 to 3', () => {
  it('gives each autosave that matches no saved entry its own id from the id source, never a shared fixed one', () => {
    let n = 0;
    const step = createLayoutSteps(createEngine(), () => `minted-${++n}`).find(s => s.from === 2);
    assert.ok(step !== undefined);
    const autosave = layoutTwoAutosave();

    const first = projectIdOf(step.migrate({[OPENISD_STATE_KEY]: autosave})[OPENISD_STATE_KEY]);
    const second = projectIdOf(step.migrate({[OPENISD_STATE_KEY]: autosave})[OPENISD_STATE_KEY]);

    assert.equal(first, 'minted-1');
    assert.equal(second, 'minted-2');
  });
});

describe('layout step 2 to 3, texts the strict read refuses', () => {
  it('gives a refused open-session text and a quarantined text their entry id, keeping the content', () => {
    const step = createLayoutSteps(createEngine(), () => 'unused').find(s => s.from === 2);
    assert.ok(step !== undefined);
    const bucket = JSON.stringify({entries: [{id: 'e-1', text: '{"label":"bad","saved":{"nope":1}}'}], focusedId: 'e-1'});

    const out = step.migrate({[OPENISD_OPEN_SESSIONS_KEY]: bucket, [OPENISD_QUARANTINE_SESSION_KEY]: bucket});

    for (const key of [OPENISD_OPEN_SESSIONS_KEY, OPENISD_QUARANTINE_SESSION_KEY]) {
      assert.equal(out[key], JSON.stringify({entries: [{id: 'e-1', text: '{"id":"e-1","label":"bad","saved":{"nope":1}}'}], focusedId: 'e-1'}));
    }
  });
});
