/** The complete browser-storage contract. Keep every persisted key here. */
export const OPENISD_STATE_KEY = 'openisd_state';
export const OPENISD_PROJECTS_KEY = 'openisd_projects';
export const OPENISD_OPEN_SESSIONS_KEY = 'openisd_open_sessions';
export const OPENISD_VIEW_KEY = 'openisd_view';
export const OPENISD_MY_DRIVERS_KEY = 'openisd_my_drivers';
export const OPENISD_MY_PASSIVE_RADIATORS_KEY = 'openisd_my_passive_radiators';
export const OPENISD_FAVOURITE_DRIVERS_KEY = 'openisd_favourite_drivers';
export const OPENISD_QUARANTINE_DRIVER_KEY = 'openisd_quarantine_driver';
export const OPENISD_QUARANTINE_SESSION_KEY = 'openisd_quarantine_session';
export const OPENISD_APP_SETTINGS_KEY = 'openisd_app_settings';

export const OPENISD_STORAGE_KEYS = Object.freeze({
  state: OPENISD_STATE_KEY,
  projects: OPENISD_PROJECTS_KEY,
  openSessions: OPENISD_OPEN_SESSIONS_KEY,
  view: OPENISD_VIEW_KEY,
  myDrivers: OPENISD_MY_DRIVERS_KEY,
  myPassiveRadiators: OPENISD_MY_PASSIVE_RADIATORS_KEY,
  favouriteDrivers: OPENISD_FAVOURITE_DRIVERS_KEY,
  quarantineDriver: OPENISD_QUARANTINE_DRIVER_KEY,
  quarantineSession: OPENISD_QUARANTINE_SESSION_KEY,
  appSettings: OPENISD_APP_SETTINGS_KEY,
});
