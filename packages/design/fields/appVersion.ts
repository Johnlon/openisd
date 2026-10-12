/** The version of the running app, typed as a sum type so formatting is exhaustive. */
export type AppVersion =
  | { kind: 'published'; version: string }
  | { kind: 'dev'; sha: string; hasChanges: boolean }
  | { kind: 'unknown' };

export interface LocalTimeParts {
  readonly monthIndex: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

export type ToLocalTime = (epochMs: number) => LocalTimeParts;

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

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
 */
export function formatAppVersion(v: AppVersion, toLocalTime: ToLocalTime): string {
  switch (v.kind) {
    case 'published': {
      const epochMs = parseUtcStampToEpochMs(v.version);
      if (epochMs === null) return v.version;
      const parts = toLocalTime(epochMs);
      const month = MONTH_NAMES[parts.monthIndex];
      if (!month) return v.version;
      const day = String(parts.day).padStart(2, '0');
      const hour = String(parts.hour).padStart(2, '0');
      const minute = String(parts.minute).padStart(2, '0');
      return `${month} ${day} ${hour}:${minute}`;
    }
    case 'dev':
      return v.hasChanges ? `dev ${v.sha} + changes` : `dev ${v.sha}`;
    case 'unknown':
      return 'unknown';
  }
}