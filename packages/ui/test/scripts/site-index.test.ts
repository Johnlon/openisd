/**
 * `scripts/hosting/siteIndex.mjs` — v/index.json and the two plain index pages, from GitHub's
 * release list. What it pins: which releases count, the shape of an entry, newest-first order,
 * one clickable row per build, ISO stamps in the HTML for the browser to format, and the
 * saved-data warning on the snapshot page only.
 */
import {afterEach, describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {runInNewContext} from 'node:vm';
import {mkdtempSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {type GithubRelease, entriesOf, entryOf, pageHtml, parseNdjson, subjectOf, toBasic, writeSite} from '../../../../scripts/hosting/siteIndex.mjs';

function release(tag: string, over: GithubRelease = {}): GithubRelease {
  return {
    tag_name: tag, prerelease: tag.startsWith('snap-'), draft: false,
    html_url: `https://github.com/Johnlon/openisd/releases/tag/${tag}`,
    published_at: '2026-01-01T01:02:59Z', body: 'Fix the thing\n\nChanges since v1:\n- abc fix', ...over,
  };
}

const R1 = release('v20260101T0102Z');
const R2 = release('v20260201T1000Z');
const S1 = release('snap-20260210T0900Z');
const S2 = release('snap-20260211T0900Z', {body: 'A <b>bold</b> & "quoted" subject'});

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, {recursive: true, force: true}); });

describe('toBasic / subjectOf', () => {
  it('writes ISO 8601 basic UTC, dropping separators and fractions', () => {
    assert.equal(toBasic('2026-01-01T01:02:03Z'), '20260101T010203Z');
    assert.equal(toBasic('2026-01-01T01:02:03.456Z'), '20260101T010203Z');
  });

  it('takes the first non-blank line of the notes as the subject', () => {
    assert.equal(subjectOf('\n  Fix the thing \n\nmore'), 'Fix the thing');
    assert.equal(subjectOf('## New\n\n- A user sentence.\n'), 'A user sentence.');
    assert.equal(subjectOf(null), '');
  });
});

describe('entryOf / entriesOf', () => {
  it('describes a release and a snapshot build', () => {
    assert.deepEqual(entryOf(R1, 'v20260101T0102Z'), {
      stamp: '20260101T0102Z', kind: 'release', tag: 'v20260101T0102Z',
      url: 'https://github.com/Johnlon/openisd/releases/tag/v20260101T0102Z',
      published: '20260101T010259Z', subject: 'Fix the thing', latest: true,
    });
    assert.equal(entryOf(S1, 'v20260101T0102Z')?.kind, 'snap');
    assert.equal(entryOf(S1, 'v20260101T0102Z')?.latest, false);
  });

  it('skips drafts, foreign tags, and a tag whose kind contradicts its pre-release flag', () => {
    assert.equal(entryOf(release('v20260101T0102Z', {draft: true}), ''), null);
    assert.equal(entryOf(release('v1.2.3'), ''), null);
    assert.equal(entryOf(release('snap-20260101T0102Z', {prerelease: false}), ''), null);
    assert.equal(entryOf(release('v20260101T0102Z', {prerelease: true}), ''), null);
  });

  it('lists every build newest first, both trails together', () => {
    const entries = entriesOf([R1, S1, R2, S2, release('nightly')], 'v20260201T1000Z');
    assert.deepEqual(entries.map(e => e.stamp), ['20260211T0900Z', '20260210T0900Z', '20260201T1000Z', '20260101T0102Z']);
    assert.deepEqual(entries.filter(e => e.latest).map(e => e.tag), ['v20260201T1000Z']);
  });

  it('parses the one-object-per-line form gh prints', () => {
    assert.deepEqual(parseNdjson(`${JSON.stringify(R1)}\n\n${JSON.stringify(S1)}\n`), [R1, S1]);
  });
});

describe('pageHtml', () => {
  const entries = entriesOf([R1, S1, R2, S2], 'v20260201T1000Z');

  it('has one row per build of its trail, and none of the other', () => {
    const snap = pageHtml('snap', entries);
    assert.equal(snap.match(/class="row"/g)?.length, 2);
    assert.ok(snap.includes('data-stamp="20260211T0900Z"') && !snap.includes('data-stamp="20260201T1000Z"'));
    const rel = pageHtml('release', entries);
    assert.equal(rel.match(/class="row"/g)?.length, 2);
    assert.ok(rel.includes('data-stamp="20260201T1000Z"') && !rel.includes('data-stamp="20260211T0900Z"'));
  });

  it('puts the ISO stamp in the row, for the browser to turn into a date', () => {
    assert.match(pageHtml('snap', entries), /<time class="when" datetime="20260211T0900Z" data-stamp="20260211T0900Z">20260211T0900Z<\/time>/);
    assert.ok(pageHtml('snap', entries).includes('<script src="../dates.js"></script>'));
  });

  it('links Launch to the build folder and GitHub to the release page; the Launch link covers the row', () => {
    const snap = pageHtml('snap', entries);
    assert.ok(snap.includes('<a class="launch" href="20260211T0900Z/">Launch</a>'));
    assert.ok(snap.includes('<a class="gh" href="https://github.com/Johnlon/openisd/releases/tag/snap-20260211T0900Z">GitHub</a>'));
    assert.match(snap, /\.launch::after \{[^}]*position: absolute; inset: 0/);
  });

  it('escapes the commit subject', () => {
    const snap = pageHtml('snap', entries);
    assert.ok(snap.includes('A &lt;b&gt;bold&lt;/b&gt; &amp; &quot;quoted&quot; subject'));
    assert.ok(!snap.includes('<b>bold</b>'));
  });

  it('warns about saved data on the snapshot page only', () => {
    assert.ok(pageHtml('snap', entries).includes('Snapshot builds may upgrade your saved data. A backup is taken first.'));
    assert.ok(!pageHtml('release', entries).includes('saved data'));
  });

  it('marks the Latest release', () => {
    assert.ok(pageHtml('release', entries).includes('Fix the thing <span class="tag">Latest</span>'));
  });

  it('says so when a trail is empty', () => {
    assert.ok(pageHtml('snap', []).includes('No snapshot builds yet.'));
  });
});

describe('writeSite', () => {
  it('writes v/index.json, v/index.html and snap/index.html', () => {
    const out = mkdtempSync(join(tmpdir(), 'site-index-'));
    dirs.push(out);
    const entries = entriesOf([R1, S1], 'v20260101T0102Z');
    writeSite(entries, out);
    assert.deepEqual(JSON.parse(readFileSync(join(out, 'v', 'index.json'), 'utf8')), entries);
    assert.ok(readFileSync(join(out, 'v', 'index.html'), 'utf8').includes('OpenISD releases'));
    assert.ok(readFileSync(join(out, 'snap', 'index.html'), 'utf8').includes('OpenISD snapshot builds'));
  });
});

describe('dates.js, the browser bundle', () => {
  it('rewrites each stamp with the design date format, in local time', () => {
    const out = mkdtempSync(join(tmpdir(), 'site-index-'));
    dirs.push(out);
    const script = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'scripts', 'hosting', 'build-client.mjs');
    const built = spawnSync('node', [script, join(out, 'dates.js')], {encoding: 'utf8'});
    assert.equal(built.status, 0, built.stderr);
    const el = (stamp: string) => ({textContent: stamp, getAttribute: () => stamp});
    const good = el('20260101T0102Z');
    const bad = el('banana');
    runInNewContext(readFileSync(join(out, 'dates.js'), 'utf8'), {document: {querySelectorAll: () => [good, bad]}});
    const d = new Date(Date.UTC(2026, 0, 1, 1, 2));
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    assert.equal(good.textContent, `${d.getDate()} ${['Jan', 'Dec'][d.getMonth() === 0 ? 0 : 1]} ${d.getFullYear()}, ${hh}:${mm}`);
    assert.equal(bad.textContent, 'banana');
  });
});
