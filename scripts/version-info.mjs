#!/usr/bin/env node
// Writes packages/ui/public/build-info.json — the ONE on-disk source of truth for the toolbar
// version ("confirm what we are seeing"). Every `vite build` (prebuild) and the playwright dev
// server regenerate it, so a freshly served app always shows the build that produced it.
//
// The version is an ISO-8601 UTC timestamp in basic format, prefixed with `v`:
//   new Date().toISOString() → "2026-01-01T01:02:03.456Z"
//   → "v20260101T010203Z"
// A build's version changes only when its timestamp second changes — rebuilds within the same
// second produce the same stamp, which is exactly what "the build" means, no more.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'ui', 'public', 'build-info.json');

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const info = { version: `v${stamp}` };

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(info, null, 2)}\n`);
console.log(`build-info.json → ${info.version}`);