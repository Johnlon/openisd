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
 *  carry one prefix letter in front of it; the hosted copies live in one folder per build kind. */
const VERSION_PREFIX = 'v';
export type BuildKind = 'release' | 'snap';
const HOSTED_DIR: Readonly<Record<BuildKind, string>> = { release: 'v', snap: 'snap' };

/** "v20260101T0102Z" or "20260101T0102Z" → "20260101T0102Z". */
export function stampOfVersion(version: string): string {
  return version.startsWith(VERSION_PREFIX) ? version.slice(VERSION_PREFIX.length) : version;
}

/** Where a build's copy is hosted, root-relative: "/v/<stamp>/" or "/snap/<stamp>/". */
export function hostedPathOf(kind: BuildKind, stamp: string): string {
  return `/${HOSTED_DIR[kind]}/${stamp}/`;
}

/** The hosted list page of one build kind, root-relative: "/v/" (releases) or "/snap/". */
export function hostedListPathOf(kind: BuildKind): string {
  return `/${HOSTED_DIR[kind]}/`;
}

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
export function formatAppVersion(v: AppVersion): string {
  switch (v.kind) {
    case 'published': {
      const epochMs = parseUtcStampToEpochMs(v.version);
      if (epochMs === null) return v.version;
      const d = new Date(epochMs);
      const month = MONTH_NAMES[d.getUTCMonth()];
      if (!month) return v.version;
      const day = String(d.getUTCDate()).padStart(2, '0');
      const hour = String(d.getUTCHours()).padStart(2, '0');
      const minute = String(d.getUTCMinutes()).padStart(2, '0');
      return `${month} ${day} ${hour}:${minute}Z`;
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