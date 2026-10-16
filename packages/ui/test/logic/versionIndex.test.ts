import {describe, expect, it, vi} from 'vitest';
import {
  describeVersions, fetchVersionIndex, parseVersionIndex, startVersionIndex, VERSION_INDEX_PATH, type BuildEntry,
} from '../../src/logic/versionIndex.js';

function entry(stamp: string, kind: 'release' | 'snap', over: Partial<BuildEntry> = {}): BuildEntry {
  return {
    stamp, kind, version: '', tag: kind === 'release' ? `v${stamp}` : `snap-${stamp}`,
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

describe('describeVersions', () => {
  const entries = [S1, R1, S2, R2];

  it('names the running build alone: no list of builds (John, 16 Oct 2026)', () => {
    expect(Object.keys(describeVersions('v20260201T1000Z', entries))).toEqual(['running']);
  });

  it('a snapshot build shows its own stamp', () => {
    expect(describeVersions('v20260210T0900Z', entries).running).toMatchObject({version: '', stamp: '20260210T0900Z'});
  });

  it('shows the running build when the list could not be read', () => {
    expect(describeVersions('v20260101T0102Z', null).running).toMatchObject({version: '', stamp: '20260101T0102Z'});
  });

  it('shows nothing on a dev server, which has no version', () => {
    expect(describeVersions('', entries)).toEqual({running: null});
  });
});

describe('the public version number', () => {
  const R3 = entry('20260301T1200Z', 'release', {version: '7.0.951', latest: true});

  it('is read from the list, and defaults to none for an older list that has no field', () => {
    expect(parseVersionIndex([R3])).toEqual([R3]);
    const {version: _ignored, ...old} = R3;
    expect(parseVersionIndex([old])).toEqual([{...R3, version: ''}]);
  });

  it('leads About with the running build\'s number and day, and keeps the stamp for beneath', () => {
    const view = describeVersions('v20260301T1200Z', [R1, R3]);
    expect(view.running?.version).toBe('7.0.951');
    expect(view.running?.stamp).toBe('20260301T1200Z');
    expect(view.running?.heading).toMatch(/^OpenISD 7\.0\.951 · \d{1,2} Mar 2026$/);
  });

  it('leads with the day alone when the running build has no number', () => {
    expect(describeVersions('v20260101T0102Z', [R1, R3]).running?.heading).toMatch(/^OpenISD · \d{1,2} Jan 2026$/);
  });
});

describe('startVersionIndex', () => {
  it('fetches once at start and describes on demand', async () => {
    const fetchFn = vi.fn(() => Promise.resolve(response([R1, R2])));
    const index = startVersionIndex('v20260101T0102Z', fetchFn);
    await index.view();
    await index.view();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect((await index.view()).running?.stamp).toBe('20260101T0102Z');
  });
});
