import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {OpenISDProject} from '@openisd/design';
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
    const id = '6f1c2a3b-4d5e-4f60-8a71-b2c3d4e5f607';
    const bucket = JSON.stringify({entries: [{id, text: '{"label":"bad","saved":{"nope":1}}'}], focusedId: id});

    const out = step.migrate({[OPENISD_OPEN_SESSIONS_KEY]: bucket, [OPENISD_QUARANTINE_SESSION_KEY]: bucket});

    for (const key of [OPENISD_OPEN_SESSIONS_KEY, OPENISD_QUARANTINE_SESSION_KEY]) {
      assert.equal(out[key], JSON.stringify({entries: [{id, text: `{"id":"${id}","label":"bad","saved":{"nope":1}}`}], focusedId: id}));
    }
  });

  it('replaces an entry key that is not a UUID with a new id, in the key, the text and the focus alike', () => {
    const minted = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
    const step = createLayoutSteps(createEngine(), () => minted).find(s => s.from === 2);
    assert.ok(step !== undefined);
    const bucket = JSON.stringify({entries: [{id: 'a', text: '{}'}], focusedId: 'a'});

    const out = step.migrate({[OPENISD_OPEN_SESSIONS_KEY]: bucket});

    assert.equal(out[OPENISD_OPEN_SESSIONS_KEY], JSON.stringify({entries: [{id: minted, text: `{"id":"${minted}"}`}], focusedId: minted}));
  });
});

function fieldOf(value: unknown, key: string): unknown {
  assert.ok(typeof value === 'object' && value !== null);
  return Object.entries(value).find(([k]) => k === key)?.[1];
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

describe('layout step 2 to 3 and the engine the app runs on', () => {
  it('writes each project the way the first save after the upgrade does, whatever the user\'s settings are', () => {
    const userEngine = createEngine({
      ventedLimits: () => ({minVb_m3: 0.002, maxVb_m3: 0.7, minFb_hz: 12, maxFb_hz: 120, minPortLen_m: 0.01, maxPortLen_m: 2, maxPortVelocity_ms: 20}),
      envDefaults: () => ({tempK: 300, humidityPct: 80, pressurePa: 95_000}),
    });
    const step = createLayoutSteps(createEngine(), () => 'unused').find(s => s.from === 2);
    assert.ok(step !== undefined);
    let projects = 0;
    for (const name of ['one-project', 'many-projects']) {
      const bucketText = fieldOf(JSON.parse(goldenText(name, 'dump-layout-2.json')), 'openisd_projects');
      assert.ok(typeof bucketText === 'string');
      const entries = fieldOf(JSON.parse(step.migrate({openisd_projects: bucketText}).openisd_projects), 'entries');
      assert.ok(isUnknownArray(entries));
      for (const entry of entries) {
        const text = fieldOf(entry, 'text');
        assert.ok(typeof text === 'string');
        const loaded = OpenISDProject.fromOwprText(text, userEngine);
        assert.ok(!Array.isArray(loaded), Array.isArray(loaded) ? loaded.join('; ') : '');
        // Sync hashes the JSON, not its layout in the text, so the indent an older text had does not matter.
        assert.deepEqual(JSON.parse(loaded.toStoredText()), JSON.parse(text));
        projects++;
      }
    }
    assert.ok(projects > 0);
  });
});
