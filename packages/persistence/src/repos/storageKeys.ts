/** The complete browser-storage contract. Keep every persisted key here. */
export const OPENISD_STATE_KEY = 'openisd_state';
export const OPENISD_PROJECTS_KEY = 'openisd_projects';
export const OPENISD_OPEN_SESSIONS_KEY = 'openisd_open_sessions';
export const OPENISD_VIEW_KEY = 'openisd_view';
export const OPENISD_MY_DRIVERS_KEY = 'openisd_my_drivers';
export const OPENISD_MY_PASSIVE_RADIATORS_KEY = 'openisd_my_passive_radiators';
export const OPENISD_FAVOURITE_DRIVERS_KEY = 'openisd_favourite_drivers';
export const OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY = 'openisd_favourite_passive_radiators';
export const OPENISD_QUARANTINE_SESSION_KEY = 'openisd_quarantine_session';
export const OPENISD_APP_SETTINGS_KEY = 'openisd_app_settings';

/** The layout of the app that last wrote the store, and that app's build stamp. Written with
 *  every store write; not part of `OPENISD_STORAGE_KEYS` (they describe the store, they are not
 *  its data). */
export const OPENISD_STORAGE_LAYOUT_KEY = 'openisd_storage_layout';
export const OPENISD_STORAGE_BUILD_KEY = 'openisd_storage_build';
/** One entry per app start: which keys were present, and how long each was. */
export const OPENISD_STORAGE_LOG_KEY = 'openisd_storage_log';
/** Whole-store backups are `openisd_backup_<build stamp of the app that wrote the store>`. */
export const OPENISD_BACKUP_PREFIX = 'openisd_backup_';
/** Every key this app owns starts with this. */
export const OPENISD_KEY_PREFIX = 'openisd_';

/** Where each record's pre-repair text is kept: written before a repaired or replacing write,
 *  newest only, so the user can download what was there. */
export const OPENISD_BACKUP_KEYS = Object.freeze({
  state: 'openisd_state_backup',
  projects: 'openisd_projects_backup',
  openSessions: 'openisd_open_sessions_backup',
  view: 'openisd_view_backup',
  appSettings: 'openisd_app_settings_backup',
});

export const OPENISD_STORAGE_KEYS = Object.freeze({
  state: OPENISD_STATE_KEY,
  projects: OPENISD_PROJECTS_KEY,
  openSessions: OPENISD_OPEN_SESSIONS_KEY,
  view: OPENISD_VIEW_KEY,
  myDrivers: OPENISD_MY_DRIVERS_KEY,
  myPassiveRadiators: OPENISD_MY_PASSIVE_RADIATORS_KEY,
  favouriteDrivers: OPENISD_FAVOURITE_DRIVERS_KEY,
  favouritePassiveRadiators: OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY,
  quarantineSession: OPENISD_QUARANTINE_SESSION_KEY,
  appSettings: OPENISD_APP_SETTINGS_KEY,
});
