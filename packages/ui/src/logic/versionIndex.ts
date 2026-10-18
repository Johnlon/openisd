import {type BuildKind, formatDay, runningHeading, parseBasicUtc, stampOfVersion} from '@openisd/design/fields';

export type {BuildKind};

/** Where the deploy publishes the list of every hosted build. Absolute on purpose: the same bytes
 *  run at openisd.app, test.openisd.app and under snapshots.openisd.app, and all of them read the
 *  one list, which lives with the builds (GitHub Pages lets any site read it). */
const VERSION_INDEX_URL = 'https://snapshots.openisd.app/v/index.json';

/** One hosted build, as v/index.json states it (scripts/hosting/siteIndex.mjs writes it). */
export interface BuildEntry {
  /** "20260101T0102Z" — the build's name in tags, zips and folders. */
  readonly stamp: string;
  readonly kind: BuildKind;
  readonly tag: string;
  /** The public number from the release title, "7.0.951"; '' for a snapshot or an older release. */
  readonly version: string;
  /** The build's GitHub release page. */
  readonly url: string;
  /** ISO 8601 basic UTC. */
  readonly published: string;
  readonly subject: string;
  readonly latest: boolean;
}

/** The build that is running, as About names it first: "OpenISD 7.0.951 · 15 Oct 2026". */
export interface RunningBuild {
  /** "7.0.951"; '' when the build has no public number (a snapshot, an older release, no list). */
  readonly version: string;
  /** "OpenISD 7.0.951 · 15 Oct 2026", the day in the viewer's time zone. */
  readonly heading: string;
  /** "20261015T1542Z", shown small beneath. */
  readonly stamp: string;
}

/** What About says about versions: the running build alone (John, 16 Oct 2026: "I never asked for the
 *  about to show a list of releases"). The hosted list is read only for the running release's number. */
export interface VersionsView {
  /** The running build; null when the running build is unknown (the dev server). */
  readonly running: RunningBuild | null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function parseEntry(raw: unknown): BuildEntry | null {
  if (!isRecord(raw)) return null;
  const {stamp, kind, tag, url, published, subject, latest, version} = raw;
  if (typeof stamp !== 'string' || parseBasicUtc(stamp) === null) return null;
  if (kind !== 'release' && kind !== 'snap') return null;
  if (typeof tag !== 'string' || typeof url !== 'string' || typeof published !== 'string' || typeof subject !== 'string') return null;
  return {stamp, kind, tag, version: typeof version === 'string' ? version : '', url, published, subject, latest: latest === true};
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
    const r = await fetchFn(VERSION_INDEX_URL, {cache: 'no-store'});
    if (!r.ok) return null;
    return parseVersionIndex(await r.json());
  } catch {
    return null;
  }
}

function dayOf(stamp: string): string {
  const d = parseBasicUtc(stamp);
  return d === null ? stamp : formatDay(d);
}

/** The running build for About: its public number when the list names one (a release), its day and stamp. */
export function describeVersions(runningVersion: string, entries: readonly BuildEntry[] | null): VersionsView {
  const running = stampOfVersion(runningVersion);
  if (running === '') return {running: null};
  const version = entries?.find(e => e.stamp === running)?.version ?? '';
  return {running: {version, heading: runningHeading(version, dayOf(running)), stamp: running}};
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
