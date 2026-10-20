#!/usr/bin/env node
// Writes a before/after page for John: one item per picture, each with its own comment box.
//   node scripts/visual/diff-page.mjs <outdir> <title> <entries.json> [task-id]
// entries.json: [{"name": "mobile-wizard-sealed-step4", "before": "/path/a.png", "after": "/path/b.png", "diff": "/path/d.png"}]
// before, after and diff may each be null (a new or removed screen, or no diff picture). Pictures are
// copied into <outdir>, so the page stands alone.
// The page itself is made by ui-gallery/bin/feedback-page.py (rule: John's pages are never hand-built):
// this script copies the pictures, marks them with ui-gallery/bin/mark-diff.py (a red box on what changed,
// or on the whole screen when nothing can be told apart), writes <outdir>/index.md and runs the tool.
// Comments go to the board item in VISUAL_FEEDBACK_ITEM (default QO284).
import {spawnSync} from 'node:child_process';
import {copyFileSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const [outDir, title, entriesFile, task = ''] = process.argv.slice(2);
if (!outDir || !title || !entriesFile) {
  console.error('usage: diff-page.mjs <outdir> <title> <entries.json> [task-id]');
  process.exit(2);
}
const galleryBin = process.env.VISUAL_GALLERY_BIN ?? '/home/john/work/winisd/ui-gallery/bin';
const item = process.env.VISUAL_FEEDBACK_ITEM ?? 'QO284';
const entries = JSON.parse(readFileSync(entriesFile, 'utf8'));
mkdirSync(outDir, {recursive: true});

const cell = text => String(text).replace(/\|/g, '/').replace(/\n/g, ' ');
const run = (script, args) => spawnSync('python3', [join(galleryBin, script), ...args], {encoding: 'utf8'});

function copy(name, kind, source) {
  if (source === null || source === undefined) return null;
  const file = `${name}.${kind}.png`;
  copyFileSync(source, join(outDir, file));
  return file;
}

// PNG width and height are the two big-endian ints after the 8-byte signature and the IHDR header.
function size(file) {
  const head = readFileSync(join(outDir, file)).subarray(0, 24);
  return [head.readUInt32BE(16), head.readUInt32BE(20)];
}

function markWhole(file) {
  let w, h;
  try { [w, h] = size(file); } catch { return null; }  // not a picture: nothing to mark
  return run('mark-diff.py', [join(outDir, file), '--box', `0,0,${w},${h}`]);
}

function mark(before, after, diff) {
  if (before && after) {
    const r = run('mark-diff.py', [join(outDir, before), join(outDir, after)]);
    if (r.status === 1 || r.status === 2) { markWhole(before); markWhole(after); }  // same, or the change fills the picture
    else if (r.status !== 0) console.error(`mark-diff failed: ${r.stderr}`);
  } else {
    for (const f of [before, after]) if (f) markWhole(f);
  }
  if (diff) run('mark-diff.py', ['--stamp', join(outDir, diff)]);
}

function look(before, after, diff) {
  if (!before) return 'the whole screen: it is new, there is no before picture';
  if (!after) return 'the whole screen: it is removed, there is no after picture';
  return `the red box on each picture: what changed on this screen; compare the before and the after${diff ? ', the third picture shows where they differ' : ''}`;
}

const rows = entries.map(entry => {
  const before = copy(entry.name, 'before', entry.before);
  const after = copy(entry.name, 'after', entry.after);
  const diff = copy(entry.name, 'diff', entry.diff);
  mark(before, after, diff);
  const links = [['before', before], ['after', after], ['difference', diff]].filter(([, f]) => f).map(([label, f]) => `[${label}](${f})`);
  return `| ${cell(entry.name)} | ${cell(task || 'visual')} | landed | ${links.join(' ')} | ${cell(look(before, after, diff))} |`;
});

writeFileSync(join(outDir, 'index.md'), `# ${cell(title)}\n| Fix | Task | State | Pictures | Look at |\n|---|---|---|---|---|\n${rows.join('\n')}\n`);
const todo = 'Look at the red box on each picture and type under it whether the new look is right or wrong. Nothing else to do.';
const page = spawnSync('python3', [join(galleryBin, 'feedback-page.py'), outDir, '--item', item, '--todo', todo], {encoding: 'utf8'});
if (page.status !== 0) { console.error(`feedback-page.py failed: ${page.stderr}`); process.exit(1); }
console.log(`${entries.length} screen(s) in ${join(outDir, 'index.html')}`);
