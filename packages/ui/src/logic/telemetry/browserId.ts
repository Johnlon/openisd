import type {KeyValueStorage} from '@openisd/persistence';

/** The anonymous browser id lives under its own key: not in projects or state, so it is never backed
 *  up, exported or synced. */
export const BROWSER_ID_KEY = 'openisd_telemetry_id';

/** The id held for this browser; minted and stored on first use. A browser that cannot store gets a
 *  fresh one each page load, which only costs the returning-user count. */
export function browserIdOf(storage: KeyValueStorage, newId: () => string): string {
  const held = storage.get(BROWSER_ID_KEY);
  if (held !== null && held !== '') return held;
  const minted = newId();
  storage.set(BROWSER_ID_KEY, minted);
  return minted;
}
