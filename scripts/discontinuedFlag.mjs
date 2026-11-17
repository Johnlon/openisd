/**
 * discontinuedFlag.mjs — whether a corpus record's manufacturer has discontinued the part.
 *
 * The one thing the bundler reads from the scraper's `driver.json` (QO450; John 2026-11-16: the part stays
 * listed and the flag is carried on its index row). Only the top-level boolean `discontinued` is read;
 * a missing driver.json, unparseable file, or any other value means "not discontinued".
 */
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

const SCRAPER_RECORD_FILE = 'driver.json';

/** True when `<recordDir>/driver.json` has top-level `"discontinued": true`. */
export function isDiscontinued(recordDir) {
  const file = join(recordDir, SCRAPER_RECORD_FILE);
  if (!existsSync(file)) return false;
  try {
    return JSON.parse(readFileSync(file, 'utf8'))?.discontinued === true;
  } catch {
    return false;
  }
}
