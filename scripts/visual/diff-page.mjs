#!/usr/bin/env node
// Writes a before/after page for John: one row per screen, its pictures side by side.
//   node scripts/visual/diff-page.mjs <outdir> <title> <entries.json>
// entries.json: [{"name": "mobile-wizard-sealed-step4", "before": "/path/a.png", "after": "/path/b.png", "diff": "/path/d.png"}]
// before, after and diff may each be null (a new or removed screen, or no diff picture). Pictures are
// copied into <outdir>, so the page stands alone.
import {copyFileSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {basename, join} from 'node:path';

const [outDir, title, entriesFile] = process.argv.slice(2);
if (!outDir || !title || !entriesFile) {
  console.error('usage: diff-page.mjs <outdir> <title> <entries.json>');
  process.exit(2);
}
const entries = JSON.parse(readFileSync(entriesFile, 'utf8'));
mkdirSync(outDir, {recursive: true});

const escape = text => String(text).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

function picture(name, kind, source) {
  if (source === null || source === undefined) return '<em>none</em>';
  const file = `${name}.${kind}.png`;
  copyFileSync(source, join(outDir, file));
  return `<a href="${escape(file)}"><img src="${escape(file)}" width="300" alt="${escape(kind)}"></a>`;
}

const rows = entries.map(entry => `<tr><td>${escape(entry.name)}</td><td>${picture(entry.name, 'before', entry.before)}</td>`
  + `<td>${picture(entry.name, 'after', entry.after)}</td><td>${picture(entry.name, 'diff', entry.diff)}</td></tr>`).join('\n');

writeFileSync(join(outDir, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escape(title)}</title>
<style>body{font:14px sans-serif;margin:16px}td,th{vertical-align:top;padding:6px;border-top:1px solid #ccc;text-align:left}</style>
<h1>${escape(title)}</h1>
<table><tr><th>screen</th><th>before</th><th>after</th><th>difference</th></tr>
${rows}
</table>
`);
console.log(`${entries.length} screen(s) in ${join(outDir, basename('index.html'))}`);
