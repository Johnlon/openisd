#!/usr/bin/env node
// Writes packages/ui/public/build-info.json — the ONE on-disk source of truth for the toolbar
// version ("confirm what we are seeing"). Every `vite build` (prebuild) and the playwright dev
// server regenerate it, so a freshly served app always shows the build that produced it.
//
// The version is an ISO-8601 UTC timestamp in basic format at MINUTE resolution, prefixed `v`:
//   new Date().toISOString() → "2026-01-01T01:02:03.456Z"
//   → "v20260101T0102Z"
// A build's version changes only when its timestamp minute changes — rebuilds within the same
// minute produce the same stamp, which is exactly what "the build" means, no more.
//
// <stamp> is "20260101T0102Z"; the version is "v" + stamp, which is also the release tag's name.
// When the build runs for a tag (GITHUB_REF=refs/tags/snap-<stamp> or refs/tags/v<stamp>) the
// stamp is the tag's own, so a build made for a tag carries the tag's name, not the clock's.
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const TAG_REF = /^refs\/tags\/(?:snap-|v)(\d{8}T\d{4}Z)$/;

/** "20260101T0102Z" — the stamp in tag, zip and folder names — for the instant `now`. */
export function stampOf(now) {
  return now.toISOString().replace(/[-:]/g, '').replace(/\d{2}\.\d+Z$/, 'Z');
}

/** The build's stamp: the tag's when `githubRef` is a snap- or v tag, else `now`'s. */
export function buildStamp(githubRef, now) {
  const m = TAG_REF.exec(githubRef ?? '');
  return m ? m[1] : stampOf(now);
}

/** The version the app shows and reports: `v` + stamp, equal to the release tag's name. */
export function versionOf(stamp) {
  return `v${stamp}`;
}

// `--stamp` prints the stamp and writes nothing (scripts/snap.sh names its tag and zip with it).
// OPENISD_NOW (an ISO 8601 instant) stands in for the clock, so a test can fix the minute.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const now = process.env.OPENISD_NOW ? new Date(process.env.OPENISD_NOW) : new Date();
  if (process.argv.includes('--stamp')) {
    console.log(buildStamp(process.env.GITHUB_REF, now));
    process.exit(0);
  }
  const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'ui', 'public', 'build-info.json');
  const info = { version: versionOf(buildStamp(process.env.GITHUB_REF, now)) };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(info, null, 2)}\n`);
  console.log(`build-info.json → ${info.version}`);
}
