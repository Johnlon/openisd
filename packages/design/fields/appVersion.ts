/** The version of the running app, typed as a sum type so formatting is exhaustive. */
export type AppVersion =
  | { kind: 'published'; version: string }
  | { kind: 'dev'; sha: string; hasChanges: boolean }
  | { kind: 'unknown' };

/** Format an AppVersion into the label text shown in the UI. */
export function formatAppVersion(v: AppVersion): string {
  switch (v.kind) {
    case 'published':
      return `v${v.version}`;
    case 'dev':
      return v.hasChanges ? `dev ${v.sha} + changes` : `dev ${v.sha}`;
    case 'unknown':
      return 'unknown';
  }
}