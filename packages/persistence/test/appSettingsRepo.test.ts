/**
 * `createAppSettingsRepo` — the plausibility band the user owns, stored browser-local.
 *
 * The band is an APPLICATION setting, not a project one: it says which designed values a person
 * wants flagged, so it follows the person, not the file. Nothing stored is trusted — a record
 * that is absent, unparseable, incomplete, non-numeric or inside out reads as the factory band
 * rather than crashing a cell's DQ.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {DEFAULT_VENTED_DESIGN_LIMITS, DEFAULT_ENV_DEFAULTS} from '@openisd/design/engine';
import type {VentedDesignLimits, EnvDefaults} from '@openisd/design/engine';
import {createMemoryStorage} from '../src/storage/keyValueStorage.js';
import {createAppSettingsRepo, APP_SETTINGS_KEY} from '../src/repos/appSettingsRepo.js';

const EDITED: VentedDesignLimits = Object.freeze({
  minVb_m3: 0.002, maxVb_m3: 0.5, minFb_hz: 15, maxFb_hz: 120,
});

describe('createAppSettingsRepo', () => {
  it('answers the factory band when nothing is stored', () => {
    const repo = createAppSettingsRepo(createMemoryStorage());
    assert.deepEqual(repo.ventedLimits(), DEFAULT_VENTED_DESIGN_LIMITS);
  });

  it('round-trips an edited band', () => {
    const storage = createMemoryStorage();
    createAppSettingsRepo(storage).setVentedLimits(EDITED);
    assert.deepEqual(createAppSettingsRepo(storage).ventedLimits(), EDITED);
  });

  it('writes under the one declared key', () => {
    const storage = createMemoryStorage();
    createAppSettingsRepo(storage).setVentedLimits(EDITED);
    assert.notEqual(storage.get(APP_SETTINGS_KEY), null);
  });

  it('falls back to the factory band on unparseable storage', () => {
    const repo = createAppSettingsRepo(createMemoryStorage({[APP_SETTINGS_KEY]: 'not json'}));
    assert.deepEqual(repo.ventedLimits(), DEFAULT_VENTED_DESIGN_LIMITS);
  });

  it('falls back when a limit is missing or not a number', () => {
    const missing = JSON.stringify({vented: {minVb_m3: 0.002, maxVb_m3: 0.5, minFb_hz: 15}});
    assert.deepEqual(
      createAppSettingsRepo(createMemoryStorage({[APP_SETTINGS_KEY]: missing})).ventedLimits(),
      DEFAULT_VENTED_DESIGN_LIMITS);

    const text = JSON.stringify({vented: {...EDITED, maxFb_hz: '120'}});
    assert.deepEqual(
      createAppSettingsRepo(createMemoryStorage({[APP_SETTINGS_KEY]: text})).ventedLimits(),
      DEFAULT_VENTED_DESIGN_LIMITS);
  });

  it('falls back on a band that is inside out or not positive', () => {
    const insideOut = JSON.stringify({vented: {...EDITED, minVb_m3: 0.9, maxVb_m3: 0.1}});
    assert.deepEqual(
      createAppSettingsRepo(createMemoryStorage({[APP_SETTINGS_KEY]: insideOut})).ventedLimits(),
      DEFAULT_VENTED_DESIGN_LIMITS);

    const negative = JSON.stringify({vented: {...EDITED, minFb_hz: -5}});
    assert.deepEqual(
      createAppSettingsRepo(createMemoryStorage({[APP_SETTINGS_KEY]: negative})).ventedLimits(),
      DEFAULT_VENTED_DESIGN_LIMITS);
  });

  it('reads back exactly what it stored, not a live reference', () => {
    const storage = createMemoryStorage();
    const repo = createAppSettingsRepo(storage);
    repo.setVentedLimits(EDITED);
    const first = repo.ventedLimits();
    repo.setVentedLimits({...EDITED, maxFb_hz: 90});
    assert.equal(first.maxFb_hz, 120);
    assert.equal(repo.ventedLimits().maxFb_hz, 90);
  });

  describe('environment defaults', () => {
    const EDITED_ENV: EnvDefaults = Object.freeze({tempK: 300, humidityPct: 45, pressurePa: 99000});

    it('answers the factory env defaults when nothing is stored', () => {
      const repo = createAppSettingsRepo(createMemoryStorage());
      assert.deepEqual(repo.envDefaults(), DEFAULT_ENV_DEFAULTS);
    });

    it('round-trips edited env defaults', () => {
      const storage = createMemoryStorage();
      createAppSettingsRepo(storage).setEnvDefaults(EDITED_ENV);
      assert.deepEqual(createAppSettingsRepo(storage).envDefaults(), EDITED_ENV);
    });

    it('keeps the vented band when only env defaults are set, and vice versa', () => {
      const storage = createMemoryStorage();
      const repo = createAppSettingsRepo(storage);
      repo.setVentedLimits(EDITED);
      repo.setEnvDefaults(EDITED_ENV);
      assert.deepEqual(repo.ventedLimits(), EDITED);
      assert.deepEqual(repo.envDefaults(), EDITED_ENV);
    });

    it('falls back to factory env defaults on out-of-range storage', () => {
      const outOfRange = JSON.stringify({vented: DEFAULT_VENTED_DESIGN_LIMITS, env: {...EDITED_ENV, humidityPct: 150}});
      assert.deepEqual(
        createAppSettingsRepo(createMemoryStorage({[APP_SETTINGS_KEY]: outOfRange})).envDefaults(),
        DEFAULT_ENV_DEFAULTS);
    });

    it('reads a legacy record with no env member as the factory env defaults', () => {
      const legacy = JSON.stringify({vented: DEFAULT_VENTED_DESIGN_LIMITS});
      assert.deepEqual(
        createAppSettingsRepo(createMemoryStorage({[APP_SETTINGS_KEY]: legacy})).envDefaults(),
        DEFAULT_ENV_DEFAULTS);
    });
  });
});
