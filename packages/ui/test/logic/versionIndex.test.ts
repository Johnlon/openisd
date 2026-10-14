import {describe, expect, it, vi} from 'vitest';
import {
  describeVersions, fetchVersionIndex, parseVersionIndex, startVersionIndex, VERSION_INDEX_PATH, type BuildEntry,
} from '../../src/logic/versionIndex.js';

function entry(stamp: string, kind: 'release' | 'snap', over: Partial<BuildEntry> = {}): BuildEntry {
  return {
    stamp, kind, tag: kind === 'release' ? `v${stamp}` : `snap-${stamp}`,
    url: `https://github.com/Johnlon/openisd/releases/tag/${stamp}`,
    published: `${stamp.slice(0, 13)}00Z`, subject: 'a change', latest: false, ...over,
  };
}

const R1 = entry('20260101T0102Z', 'release');
const R2 = entry('20260201T1000Z', 'release', {latest: true});
const S1 = entry('20260210T0900Z', 'snap');
const S2 = entry('20260211T0900Z', 'snap');

function response(body: unknown, ok = true): Response {
  return new Response(JSON.stringify(body), {status: ok ? 200 : 404});
}

describe('parseVersionIndex', () => {
  it('keeps well-formed builds and drops rows that are not builds', () => {
    const parsed = parseVersionIndex([R1, {stamp: 'banana', kind: 'release'}, 42, null, S1]);
    expect(parsed).toEqual([R1, S1]);
  });

  it('is null for anything that is not a list', () => {
    expect(parseVersionIndex({builds: []})).toBeNull();
    expect(parseVersionIndex('x')).toBeNull();
  });

  it('refuses a kind other than release or snap', () => {
    expect(parseVersionIndex([{...R1, kind: 'nightly'}])).toEqual([]);
  });
});

describe('fetchVersionIndex', () => {
  it('reads /v/index.json uncached', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(response([R1])));
    expect(await fetchVersionIndex(fetchFn)).toEqual([R1]);
    expect(fetchFn).toHaveBeenCalledWith(VERSION_INDEX_PATH, {cache: 'no-store'});
  });

  it('is null on a missing list, a network failure and unparseable text', async () => {
    expect(await fetchVersionIndex(() => Promise.resolve(response([], false)))).toBeNull();
    expect(await fetchVersionIndex(() => Promise.reject(new Error('offline')))).toBeNull();
    expect(await fetchVersionIndex(() => Promise.resolve(new Response('not json')))).toBeNull();
  });
});

const RUNNING_FROM = 'https://openisd.app/snap/20260101T0102Z/';

describe('describeVersions', () => {
  it('carries the directory the app runs from', () => {
    expect(describeVersions('', null, RUNNING_FROM).runningFrom).toBe(RUNNING_FROM);
  });

  const entries = [S1, R1, S2, R2];

  it('a release build lists releases only, newest first, and links to the releases page', () => {
    const view = describeVersions('v20260201T1000Z', entries, RUNNING_FROM);
    expect(view.rows.map(r => r.stamp)).toEqual(['20260201T1000Z', '20260101T0102Z']);
    expect(view.releasesPath).toBe('/v/');
    expect(view.snapshotsPath).toBeNull();
  });

  it('a snapshot build lists releases first, then snapshots, each newest first, and links to both pages', () => {
    const view = describeVersions('v20260210T0900Z', entries, RUNNING_FROM);
    expect(view.rows.map(r => r.stamp)).toEqual(['20260201T1000Z', '20260101T0102Z', '20260211T0900Z', '20260210T0900Z']);
    expect(view.rows.map(r => r.kind)).toEqual(['release', 'release', 'snap', 'snap']);
    expect(view.snapshotsPath).toBe('/snap/');
  });

  it('the dev server, which has no version, lists both kinds', () => {
    const view = describeVersions('', entries, RUNNING_FROM);
    expect(view.rows).toHaveLength(4);
    expect(view.snapshotsPath).toBe('/snap/');
  });

  it('marks the running build and no other', () => {
    const view = describeVersions('v20260210T0900Z', entries, RUNNING_FROM);
    expect(view.rows.filter(r => r.current).map(r => r.stamp)).toEqual(['20260210T0900Z']);
  });

  it('shows the date as "1 Jan 2026, 01:02" through the design formatter, in local time', () => {
    const view = describeVersions('v20260101T0102Z', [R1], RUNNING_FROM);
    const expected = new Date(Date.UTC(2026, 0, 1, 1, 2));
    const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][expected.getMonth()];
    const hh = String(expected.getHours()).padStart(2, '0');
    const mm = String(expected.getMinutes()).padStart(2, '0');
    expect(view.rows[0]?.date).toBe(`${expected.getDate()} ${month} 2026, ${hh}:${mm}`);
  });

  it('links each build to its hosted copy and its GitHub page', () => {
    const view = describeVersions('v20260210T0900Z', [R1, S1], RUNNING_FROM); // running a snapshot, so both are listed
    expect(view.rows[0]).toMatchObject({hostedPath: '/v/20260101T0102Z/', githubUrl: R1.url});
    expect(view.rows[1]).toMatchObject({hostedPath: '/snap/20260210T0900Z/', githubUrl: S1.url});
  });

  it('says what the latest release is when the running build is older than it', () => {
    const view = describeVersions('v20260101T0102Z', entries, RUNNING_FROM);
    expect(view.staleNotice).toMatch(/^latest release is \d{1,2} \w{3} 2026, \d{2}:\d{2}$/);
  });

  it('says nothing when the running build is the latest release or newer', () => {
    expect(describeVersions('v20260201T1000Z', entries, RUNNING_FROM).staleNotice).toBeNull();
    expect(describeVersions('v20260211T0900Z', entries, RUNNING_FROM).staleNotice).toBeNull();
  });

  it('shows the running build alone, without links, when the list could not be read', () => {
    const view = describeVersions('v20260101T0102Z', null, RUNNING_FROM);
    expect(view.rows).toHaveLength(1);
    expect(view.rows[0]).toMatchObject({stamp: '20260101T0102Z', current: true, hostedPath: null, githubUrl: null});
    expect(view.staleNotice).toBeNull();
  });

  it('shows nothing on a dev server, which has no version', () => {
    expect(describeVersions('', null, RUNNING_FROM)).toEqual({rows: [], staleNotice: null, releasesPath: '/v/', snapshotsPath: null, runningFrom: RUNNING_FROM});
    expect(describeVersions('', entries, RUNNING_FROM).staleNotice).toBeNull();
  });
});

describe('startVersionIndex', () => {
  it('fetches once at start and describes on demand', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(response([R1, R2])));
    const index = startVersionIndex('v20260101T0102Z', fetchFn, RUNNING_FROM);
    await index.view();
    await index.view();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect((await index.view()).staleNotice).not.toBeNull();
  });
});
