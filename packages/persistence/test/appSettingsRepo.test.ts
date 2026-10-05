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
import {OPENISD_BACKUP_KEYS} from '../src/repos/storageKeys.js';
import {isStoredDataFault, type StoredDataFault} from '../src/repos/storedDataFault.js';

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

  describe('WinISD difference markers (≠W)', () => {
    const ENV: EnvDefaults = Object.freeze({tempK: 300, humidityPct: 40, pressurePa: 100000});

    it('shows them when nothing is stored (John, 2026-10-05: default show, for education)', () => {
      assert.equal(createAppSettingsRepo(createMemoryStorage()).differenceCuesShown(), true);
    });

    it('round-trips hiding them, and keeps the other settings', () => {
      const storage = createMemoryStorage();
      createAppSettingsRepo(storage).setVentedLimits(EDITED);
      createAppSettingsRepo(storage).setEnvDefaults(ENV);
      createAppSettingsRepo(storage).setDifferenceCuesShown(false);
      const back = createAppSettingsRepo(storage);
      assert.equal(back.differenceCuesShown(), false);
      assert.deepEqual(back.ventedLimits(), EDITED);
      assert.deepEqual(back.envDefaults(), ENV);
      back.setEnvDefaults(DEFAULT_ENV_DEFAULTS);
      back.setVentedLimits(DEFAULT_VENTED_DESIGN_LIMITS);
      assert.equal(createAppSettingsRepo(storage).differenceCuesShown(), false);
    });

    it('reads a member that is not a boolean as shown, and reports it', () => {
      const faults: StoredDataFault[] = [];
      const text = JSON.stringify({vented: DEFAULT_VENTED_DESIGN_LIMITS, differenceCues: 'no'});
      const repo = createAppSettingsRepo(createMemoryStorage({[APP_SETTINGS_KEY]: text}), f => faults.push(f));
      assert.equal(repo.differenceCuesShown(), true);
      assert.equal(faults.length, 1);
    });
  });

  describe('repair, never reset (BUG_20261001_view-and-options-bad-value-silently-resets-whole-record)', () => {
    const ENV: EnvDefaults = Object.freeze({tempK: 300, humidityPct: 40, pressurePa: 100000});

    it('a bad vented band does not cost the stored environment defaults', () => {
      const text = JSON.stringify({vented: 'garbage', env: ENV});
      const repo = createAppSettingsRepo(createMemoryStorage({[APP_SETTINGS_KEY]: text}));
      assert.deepEqual(repo.ventedLimits(), DEFAULT_VENTED_DESIGN_LIMITS);
      assert.deepEqual(repo.envDefaults(), ENV);
    });

    it('a write over a record with a bad member backs the original text up first', () => {
      const text = JSON.stringify({vented: 'garbage', env: ENV});
      const storage = createMemoryStorage({[APP_SETTINGS_KEY]: text});
      createAppSettingsRepo(storage).setVentedLimits(EDITED);
      assert.equal(storage.get(OPENISD_BACKUP_KEYS.appSettings), text);
      assert.deepEqual(createAppSettingsRepo(storage).envDefaults(), ENV);
    });

    it('a write over a clean record takes no backup', () => {
      const storage = createMemoryStorage();
      createAppSettingsRepo(storage).setVentedLimits(EDITED);
      createAppSettingsRepo(storage).setEnvDefaults(ENV);
      assert.equal(storage.get(OPENISD_BACKUP_KEYS.appSettings), null);
    });
  });
});

describe('createAppSettingsRepo — says when stored Options could not be read', () => {
  function reported(storedText: string | null): StoredDataFault[] {
    const storage = createMemoryStorage();
    if (storedText !== null) storage.set(APP_SETTINGS_KEY, storedText);
    const faults: StoredDataFault[] = [];
    const repo = createAppSettingsRepo(storage, fault => faults.push(fault));
    repo.ventedLimits();
    repo.envDefaults();
    repo.ventedLimits();   // reading again must not report again
    return faults;
  }

  it('reports nothing for absent or readable Options', () => {
    assert.deepEqual(reported(null), []);
    assert.deepEqual(reported(JSON.stringify({env: DEFAULT_ENV_DEFAULTS})), []);
  });

  it('reports once, naming the options store, when the text is not JSON', () => {
    const faults = reported('not json');
    assert.equal(faults.length, 1);
    assert.ok(isStoredDataFault(faults[0]));
    assert.equal(faults[0].store, 'options');
  });

  it('reports once when a member does not parse, however often it is read', () => {
    assert.equal(reported(JSON.stringify({env: 1})).length, 1);
  });
});
