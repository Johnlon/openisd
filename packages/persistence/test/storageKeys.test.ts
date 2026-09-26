import {describe, expect, it} from 'vitest';
import {OPENISD_STORAGE_KEYS} from '../src/repos/storageKeys.js';

describe('OpenISD browser storage keys', () => {
  it('publishes one complete, stable key list', () => {
    expect(OPENISD_STORAGE_KEYS).toEqual({
      state: 'openisd_state',
      projects: 'openisd_projects',
      openSessions: 'openisd_open_sessions',
      view: 'openisd_view',
      myDrivers: 'openisd_my_drivers',
      myPassiveRadiators: 'openisd_my_passive_radiators',
      favouriteDrivers: 'openisd_favourite_drivers',
      quarantineDriver: 'openisd_quarantine_driver',
      quarantineSession: 'openisd_quarantine_session',
    appSettings: 'openisd_app_settings',
    });
  });
});
