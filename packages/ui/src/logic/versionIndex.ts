import {type BuildKind, formatDateTime, formatDay, runningHeading, hostedListPathOf, hostedPathOf, parseBasicUtc, stampOfVersion} from '@openisd/design/fields';

export type {BuildKind};

/** Where the deploy publishes the list of every hosted build. Root-relative on purpose: the same
 *  bytes run at the site root, under /v/<stamp>/ and under /snap/<stamp>/, and all of them read
 *  the one list at the root. */
export const VERSION_INDEX_PATH = '/v/index.json';

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

/** One line of the About dialog's Versions list. */
export interface VersionRow {
  readonly stamp: string;
  readonly version: string;
  readonly kind: BuildKind;
  /** "1 Jan 2026, 01:02" — the build's date in the viewer's time zone. */
  readonly date: string;
  readonly current: boolean;
  /** The hosted copy and the GitHub page; null when the list could not be read. */
  readonly hostedPath: string | null;
  readonly githubUrl: string | null;
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

export interface VersionsView {
  /** The running build; null when the running build is unknown (the dev server). */
  readonly running: RunningBuild | null;
  readonly rows: readonly VersionRow[];
  /** "latest release is 1 Jan 2026, 01:02" when this build is older than the Latest release. */
  readonly staleNotice: string | null;
  /** The hosted releases page, "/v/". */
  readonly releasesPath: string;
  /** The hosted snapshot builds page, "/snap/"; null for a release build, whose users never see
   *  snapshot builds (John, 13 Oct 2026). A snapshot build and the dev server show them. */
  readonly snapshotsPath: string | null;
  /** The full URL of the directory the app runs from, "https://openisd.app/snap/20261014T1045Z/". */
  readonly runningFrom: string;
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
    const r = await fetchFn(VERSION_INDEX_PATH, {cache: 'no-store'});
    if (!r.ok) return null;
    return parseVersionIndex(await r.json());
  } catch {
    return null;
  }
}

function dateOf(stamp: string): string {
  const d = parseBasicUtc(stamp);
  return d === null ? stamp : formatDateTime(d);
}

function dayOf(stamp: string): string {
  const d = parseBasicUtc(stamp);
  return d === null ? stamp : formatDay(d);
}

/** What About shows: releases newest first, the running build marked, and a link to the releases
 *  page. Snapshot builds appear only when the running build is itself a snapshot build or the dev
 *  server: a release's users are never shown them. Just the running build when the list is
 *  unavailable. */
export function describeVersions(runningVersion: string, entries: readonly BuildEntry[] | null, runningFrom: string): VersionsView {
  const running = stampOfVersion(runningVersion);
  const releasesPath = hostedListPathOf('release');
  const runningEntry = entries?.find(e => e.stamp === running);
  const runningBuild: RunningBuild | null = running === '' ? null : {version: runningEntry?.version ?? '', heading: runningHeading(runningEntry?.version ?? '', dayOf(running)), stamp: running};
  if (entries === null) {
    const rows: VersionRow[] = running === ''
      ? []
      : [{stamp: running, version: '', kind: 'release', date: dateOf(running), current: true, hostedPath: null, githubUrl: null}];
    return {running: runningBuild, rows, staleNotice: null, releasesPath, snapshotsPath: null, runningFrom};
  }
  const newestFirst = (a: BuildEntry, b: BuildEntry): number => (a.stamp < b.stamp ? 1 : a.stamp > b.stamp ? -1 : 0);
  const releases = entries.filter(e => e.kind === 'release').sort(newestFirst);
  const runningIsSnapshot = entries.some(e => e.kind === 'snap' && e.stamp === running);
  const showSnapshots = running === '' || runningIsSnapshot;
  const snaps = showSnapshots ? entries.filter(e => e.kind === 'snap').sort(newestFirst) : [];
  const rows = [...releases, ...snaps].map((e): VersionRow => ({
    stamp: e.stamp,
    version: e.version,
    kind: e.kind,
    date: dateOf(e.stamp),
    current: e.stamp === running,
    hostedPath: hostedPathOf(e.kind, e.stamp),
    githubUrl: e.url,
  }));
  const latest = entries.find(e => e.kind === 'release' && e.latest);
  const stale = running !== '' && latest !== undefined && running < latest.stamp;
  return {
    running: runningBuild,
    rows,
    staleNotice: stale ? `latest release is ${dateOf(latest.stamp)}` : null,
    releasesPath,
    snapshotsPath: showSnapshots ? hostedListPathOf('snap') : null,
    runningFrom,
  };
}

/** The hosted-builds list for About: fetched once at start, described on demand. */
export class VersionIndex {
  constructor(
    private readonly runningVersion: string,
    private readonly entries: Promise<readonly BuildEntry[] | null>,
    private readonly runningFrom: string,
  ) {}

  async view(): Promise<VersionsView> {
    return describeVersions(this.runningVersion, await this.entries, this.runningFrom);
  }
}

/** Starts the one fetch of the list; hand the result to whatever shows it. */
export function startVersionIndex(runningVersion: string, fetchFn: typeof fetch, runningFrom: string): VersionIndex {
  return new VersionIndex(runningVersion, fetchVersionIndex(fetchFn), runningFrom);
}
