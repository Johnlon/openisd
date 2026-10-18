/** The version of the running app, typed as a sum type so formatting is exhaustive. */
import {formatDateTime, parseBasicUtc} from './format.js';

export type AppVersion =
  | { kind: 'published'; version: string }
  /** `committedAt` is the commit's ISO 8601 basic UTC stamp, "20261013T1041Z"; '' when the dev server could not read it. */
  | { kind: 'dev'; sha: string; hasChanges: boolean; committedAt: string }
  | { kind: 'unknown' };

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** A build is named by its stamp, "20260101T0102Z". The published version and the release tag
 *  carry one prefix letter in front of it. */
const VERSION_PREFIX = 'v';
export type BuildKind = 'release' | 'snap';

/** "v20260101T0102Z" or "20260101T0102Z" → "20260101T0102Z". */
export function stampOfVersion(version: string): string {
  return version.startsWith(VERSION_PREFIX) ? version.slice(VERSION_PREFIX.length) : version;
}

/** Which trail the app runs from: a release (openisd.app, or snapshots.openisd.app/v/<stamp>/), a
 *  snapshots.openisd.app/snap/<stamp>/ copy, or the test.openisd.app copy of the newest snapshot. */
export type BuildTrail = 'release' | 'snap' | 'test';

/** The site that serves the newest snapshot at its root. */
export const TEST_HOSTNAME = 'test.openisd.app';

/** The page's address: `location` in the browser, or a `URL`. */
export interface PageAddress {
  readonly hostname: string;
  readonly pathname: string;
}

/** test.openisd.app → 'test', ".../snap/20261014T1045Z/" → 'snap', anything else → 'release'. */
export function trailOfLocation(address: PageAddress): BuildTrail {
  if (address.hostname === TEST_HOSTNAME) return 'test';
  if (/^\/snap\/[^/]+\//.test(address.pathname)) return 'snap';
  return 'release';
}

const TRAIL_PREFIX: Readonly<Record<BuildTrail, string>> = { release: '', snap: 'snap · ', test: 'test · ' };

const VERSION_REGEX = /^v?(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?Z$/;

function parseUtcStampToEpochMs(version: string): number | null {
  const match = VERSION_REGEX.exec(version);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6] ?? '00');
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    return null;
  }
  const epochMs = Date.UTC(year, month - 1, day, hour, minute, second);
  return Number.isNaN(epochMs) ? null : epochMs;
}

/**
 * Format an AppVersion into the label text shown in the UI.
 * This is John's direct order and overrides the usual date style for this label only.
 * The time is UTC with a Z suffix (John, 13 Oct 2026: "I want utc time"), so the label reads the
 * same as the build stamp and the hosted folder name wherever the phone happens to be.
 */
export function formatAppVersion(v: AppVersion, trail: BuildTrail): string {
  switch (v.kind) {
    case 'published': {
      const epochMs = parseUtcStampToEpochMs(v.version);
      if (epochMs === null) return v.version;
      const prefix = TRAIL_PREFIX[trail];
      const d = new Date(epochMs);
      const month = MONTH_NAMES[d.getUTCMonth()];
      if (!month) return v.version;
      const day = String(d.getUTCDate()).padStart(2, '0');
      const hour = String(d.getUTCHours()).padStart(2, '0');
      const minute = String(d.getUTCMinutes()).padStart(2, '0');
      return `${prefix}${month} ${day} ${hour}:${minute}Z`;
    }
    case 'dev': {
      // A commit id is not a "when" (John, 13 Oct 2026): the commit's date and time lead, the id follows.
      const when = parseBasicUtc(v.committedAt);
      const label = when ? `dev ${formatDateTime(when)} · ${v.sha}` : `dev ${v.sha}`;
      return v.hasChanges ? `${label} + changes` : label;
    }
    case 'unknown':
      return 'unknown';
  }
}