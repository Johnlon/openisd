import {formatDateTime, parseBasicUtc} from '@openisd/design/fields';

/** Where the deploy publishes the list of every hosted build. Root-relative on purpose: the same
 *  bytes run at the site root, under /v/<stamp>/ and under /snap/<stamp>/, and all of them read
 *  the one list at the root. */
export const VERSION_INDEX_PATH = '/v/index.json';

export type BuildKind = 'release' | 'snap';

/** One hosted build, as v/index.json states it (scripts/hosting/siteIndex.mjs writes it). */
export interface BuildEntry {
  /** "20260101T0102Z" — the build's name in tags, zips and folders. */
  readonly stamp: string;
  readonly kind: BuildKind;
  readonly tag: string;
  /** The build's GitHub release page. */
  readonly url: string;
  /** ISO 8601 basic UTC. */
  readonly published: string;
  readonly subject: string;
  readonly latest: boolean;
}

/** One line of the About dialog's Versions list. */
export interface VersionRow {
  readonly stamp: string;
  readonly kind: BuildKind;
  /** "1 Jan 2026, 01:02" — the build's date in the viewer's time zone. */
  readonly date: string;
  readonly current: boolean;
  /** The hosted copy and the GitHub page; null when the list could not be read. */
  readonly hostedPath: string | null;
  readonly githubUrl: string | null;
}

export interface VersionsView {
  readonly rows: readonly VersionRow[];
  /** "latest release is 1 Jan 2026, 01:02" when this build is older than the Latest release. */
  readonly staleNotice: string | null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function parseEntry(raw: unknown): BuildEntry | null {
  if (!isRecord(raw)) return null;
  const {stamp, kind, tag, url, published, subject, latest} = raw;
  if (typeof stamp !== 'string' || parseBasicUtc(stamp) === null) return null;
  if (kind !== 'release' && kind !== 'snap') return null;
  if (typeof tag !== 'string' || typeof url !== 'string' || typeof published !== 'string' || typeof subject !== 'string') return null;
  return {stamp, kind, tag, url, published, subject, latest: latest === true};
}

/** v/index.json into entries; rows that are not builds are dropped, anything else is null. */
export function parseVersionIndex(raw: unknown): readonly BuildEntry[] | null {
  if (!Array.isArray(raw)) return null;
  const rows: unknown[] = raw;
  const entries: BuildEntry[] = [];
  for (const row of rows) {
    const entry = parseEntry(row);
    if (entry !== null) entries.push(entry);
  }
  return entries;
}

/** The list of hosted builds, or null when it cannot be read (offline, dev server, no list yet). */
export async function fetchVersionIndex(fetchFn: typeof fetch): Promise<readonly BuildEntry[] | null> {
  try {
    const r = await fetchFn(VERSION_INDEX_PATH, {cache: 'no-store'});
    if (!r.ok) return null;
    return parseVersionIndex(await r.json());
  } catch {
    return null;
  }
}

function stampOfVersion(version: string): string {
  return version.startsWith('v') ? version.slice(1) : version;
}

function dateOf(stamp: string): string {
  const d = parseBasicUtc(stamp);
  return d === null ? stamp : formatDateTime(d);
}

/** What About shows: releases first, then snapshot builds, newest first; the running build marked;
 *  just the running build when the list is unavailable. */
export function describeVersions(runningVersion: string, entries: readonly BuildEntry[] | null): VersionsView {
  const running = stampOfVersion(runningVersion);
  if (entries === null) {
    const rows: VersionRow[] = running === ''
      ? []
      : [{stamp: running, kind: 'release', date: dateOf(running), current: true, hostedPath: null, githubUrl: null}];
    return {rows, staleNotice: null};
  }
  const newestFirst = (a: BuildEntry, b: BuildEntry): number => (a.stamp < b.stamp ? 1 : a.stamp > b.stamp ? -1 : 0);
  const releases = entries.filter(e => e.kind === 'release').sort(newestFirst);
  const snaps = entries.filter(e => e.kind === 'snap').sort(newestFirst);
  const rows = [...releases, ...snaps].map((e): VersionRow => ({
    stamp: e.stamp,
    kind: e.kind,
    date: dateOf(e.stamp),
    current: e.stamp === running,
    hostedPath: `/${e.kind === 'release' ? 'v' : 'snap'}/${e.stamp}/`,
    githubUrl: e.url,
  }));
  const latest = entries.find(e => e.kind === 'release' && e.latest);
  const stale = running !== '' && latest !== undefined && running < latest.stamp;
  return {rows, staleNotice: stale ? `latest release is ${dateOf(latest.stamp)}` : null};
}

/** The hosted-builds list for About: fetched once at start, described on demand. */
export class VersionIndex {
  constructor(
    private readonly runningVersion: string,
    private readonly entries: Promise<readonly BuildEntry[] | null>,
  ) {}

  async view(): Promise<VersionsView> {
    return describeVersions(this.runningVersion, await this.entries);
  }
}

/** Starts the one fetch of the list; hand the result to whatever shows it. */
export function startVersionIndex(runningVersion: string, fetchFn: typeof fetch): VersionIndex {
  return new VersionIndex(runningVersion, fetchVersionIndex(fetchFn));
}
