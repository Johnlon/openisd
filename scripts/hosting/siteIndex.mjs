#!/usr/bin/env node
// The site's build lists, from GitHub's release list. One job: turn releases into v/index.json and
// the two plain index pages (snap/index.html, v/index.html). No app code runs on those pages; a
// small bundle (dates.js, scripts/hosting/dates-client.mjs) only rewrites the ISO stamps into the
// design package's date format in the browser.
//
//   node scripts/hosting/siteIndex.mjs <releases.ndjson> <latest-tag> <outdir>
//     releases.ndjson  one GitHub release JSON object per line (gh api .../releases --jq '.[]')
//     latest-tag       the tag GitHub marks Latest ('' when none)
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const TAG = /^(snap-|v)(\d{8}T\d{4}Z)$/;
const PUBLIC_TITLE = /^OpenISD (\d+\.\d+\.\d+)$/;
const BASIC_FROM_ISO = /[-:]|\.\d+(?=Z$)/g;

/** ISO 8601 extended ("2026-01-01T01:02:03Z") to basic ("20260101T010203Z"). */
export function toBasic(iso) {
  return iso.replace(BASIC_FROM_ISO, '');
}

/** The first line of a release body a person reads: the first bullet, else the first plain line.
 *  Headings are skipped. snap.sh writes distilled notes (scripts/hosting/releaseNotes.mjs). */
export function subjectOf(body) {
  const lines = (body ?? '').split('\n').map(l => l.trim().replace(/^-\s+/, ''));
  return lines.find(l => l !== '' && !l.startsWith('#')) ?? '';
}

/** The public number in a release title, "OpenISD 7.0.951" → "7.0.951"; '' for any other title. */
export function publicVersionOf(title) {
  const m = PUBLIC_TITLE.exec(title ?? '');
  return m === null ? '' : m[1];
}

/** One hosted build from a GitHub release, or null when it is not one of ours. */
export function entryOf(release, latestTag) {
  if (release.draft) return null;
  const m = TAG.exec(release.tag_name ?? '');
  if (!m) return null;
  const kind = release.prerelease ? 'snap' : 'release';
  if ((kind === 'snap') !== (m[1] === 'snap-')) return null;
  return {
    stamp: m[2],
    version: publicVersionOf(release.name),
    kind,
    tag: release.tag_name,
    url: release.html_url,
    published: toBasic(release.published_at ?? release.created_at ?? ''),
    subject: subjectOf(release.body),
    latest: release.tag_name === latestTag,
  };
}

/** Every hosted build, newest first. */
export function entriesOf(releases, latestTag) {
  return releases
    .map(r => entryOf(r, latestTag))
    .filter(e => e !== null)
    .sort((a, b) => (a.stamp < b.stamp ? 1 : a.stamp > b.stamp ? -1 : 0));
}

export function parseNdjson(text) {
  return text.split('\n').filter(l => l.trim() !== '').map(l => JSON.parse(l));
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const PAGES = {
  snap: {
    title: 'OpenISD snapshot builds',
    lead: 'A snapshot build is a tested build of the latest work, made along the way. It is not a release.',
    warn: 'Snapshot builds may upgrade your saved data. A backup is taken first.',
    other: {href: '../v/', text: 'Releases'},
    empty: 'No snapshot builds yet.',
  },
  release: {
    title: 'OpenISD releases',
    lead: 'Every release stays here, exactly as it was published.',
    warn: null,
    other: {href: '../snap/', text: 'Snapshot builds'},
    empty: 'No releases yet.',
  },
};

/** One row. The Launch link is stretched over the whole row; the GitHub link sits above it. */
function rowHtml(e) {
  const latest = e.latest ? ' <span class="tag">Latest</span>' : '';
  const version = e.version === '' ? '' : `<strong class="ver">${esc(e.version)}</strong> `;
  return `    <li class="row"><time class="when" datetime="${esc(e.stamp)}" data-stamp="${esc(e.stamp)}">${esc(e.stamp)}</time>` +
    `<span class="subject">${version}${esc(e.subject)}${latest}</span>` +
    `<a class="launch" href="${esc(e.stamp)}/">Launch</a>` +
    `<a class="gh" href="${esc(e.url)}">GitHub</a></li>`;
}

/** The plain index page for one trail: kind is 'snap' or 'release'. Hosted at snap/ or v/. */
export function pageHtml(kind, entries) {
  const p = PAGES[kind];
  const rows = entries.filter(e => e.kind === kind);
  const list = rows.length === 0 ? `  <p>${p.empty}</p>` : `  <ul class="rows">\n${rows.map(rowHtml).join('\n')}\n  </ul>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${p.title}</title>
<link rel="icon" href="../icon.svg" type="image/svg+xml">
<style>
  body { margin: 0; background: #0b0e13; color: #c7d3df; font: 15px/1.5 system-ui, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 20px 16px 48px; }
  h1 { font-size: 20px; color: #e6edf3; margin: 0 0 6px; }
  p { margin: 0 0 10px; }
  a { color: #4fb0ff; }
  .warn { color: #e0b050; }
  .rows { list-style: none; margin: 16px 0 0; padding: 0; }
  .row { position: relative; display: grid; grid-template-columns: 11em 1fr auto auto; gap: 4px 14px; align-items: baseline;
         padding: 12px 8px; border-top: 1px solid #2b3a49; }
  .row:hover { background: #1b2230; }
  .when { color: #e6edf3; }
  .ver { color: #e6edf3; margin-right: 4px; }
  .tag { font-size: 11px; color: #4fb0ff; border: 1px solid #4fb0ff; border-radius: 3px; padding: 0 5px; margin-left: 6px; }
  .launch::after { content: ""; position: absolute; inset: 0; }
  .gh { position: relative; z-index: 1; }
  @media (max-width: 560px) { .row { grid-template-columns: 1fr auto auto; } .subject { grid-column: 1 / -1; order: 3; } }
</style>
</head>
<body>
<main>
  <h1>${p.title}</h1>
  <p>${p.lead}</p>
${p.warn ? `  <p class="warn">${p.warn}</p>\n` : ''}  <p><a href="${p.other.href}">${p.other.text}</a> · <a href="https://test.openisd.app/">Newest snapshot (test.openisd.app)</a> · <a href="https://openisd.app/">OpenISD</a></p>
${list}
</main>
<script src="../dates.js"></script>
</body>
</html>
`;
}

/** Writes v/index.json, snap/index.html and v/index.html under `outdir`. */
export function writeSite(entries, outdir) {
  mkdirSync(join(outdir, 'v'), {recursive: true});
  mkdirSync(join(outdir, 'snap'), {recursive: true});
  writeFileSync(join(outdir, 'v', 'index.json'), `${JSON.stringify(entries, null, 2)}\n`);
  writeFileSync(join(outdir, 'v', 'index.html'), pageHtml('release', entries));
  writeFileSync(join(outdir, 'snap', 'index.html'), pageHtml('snap', entries));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [releasesFile, latestTag, outdir] = process.argv.slice(2);
  if (!releasesFile || latestTag === undefined || !outdir) {
    console.error('usage: siteIndex.mjs <releases.ndjson> <latest-tag> <outdir>');
    process.exit(2);
  }
  const entries = entriesOf(parseNdjson(readFileSync(releasesFile, 'utf8')), latestTag);
  writeSite(entries, outdir);
  console.log(`siteIndex: ${entries.length} builds → ${outdir}/v/index.json, v/index.html, snap/index.html`);
}
