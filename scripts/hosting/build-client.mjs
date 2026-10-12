#!/usr/bin/env node
// Bundles dates-client.mjs (and the design date formatter it imports) into one small script.
//   node scripts/hosting/build-client.mjs <outfile>
import {build} from 'esbuild';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const outfile = process.argv[2];
if (!outfile) { console.error('usage: build-client.mjs <outfile>'); process.exit(2); }
const here = dirname(fileURLToPath(import.meta.url));
const result = await build({
  entryPoints: [join(here, 'dates-client.mjs')],
  bundle: true, minify: true, format: 'iife', target: 'es2020', outfile, metafile: true, logLevel: 'warning',
});
const bytes = Object.values(result.metafile.outputs)[0].bytes;
console.log(`build-client: ${outfile} (${bytes} bytes)`);
