// The unit tests a change to a type reaches, which `vitest --changed` cannot see (T815).
//
//   node scripts/lib/typeReach.mjs <base>     prints the test files (one per line) that name an exported type, interface
//                                             or enum whose declaration differs from <base>; run from the repo root
//
// vitest's module graph drops type-only imports, so a test whose fixtures are literals of a record shape is not "related"
// to the file that declares the shape. This lists those tests by name instead: coarse (a whole-word match) and
// over-inclusive on purpose, since running one test too many costs seconds and missing one costs a red main.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';

const DECL = /^export\s+(?:declare\s+)?(?:const\s+)?(?:interface|type|enum)\s+([A-Za-z_$][\w$]*)/;
const NEXT_DECL = /^(?:export|function|const|let|class|type|interface|enum|import|declare)\b/;

/** Exported type declarations at column 0: [{name, start, end}] with 1-based inclusive lines; a block runs to the line before the next top-level declaration. */
export function exportedTypeBlocks(source) {
  const lines = source.split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const m = DECL.exec(lines[i]);
    if (!m) continue;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (NEXT_DECL.test(lines[j])) { end = j; break; }
    }
    blocks.push({name: m[1], start: i + 1, end});
  }
  return blocks;
}

export function changedTypeNames(source, changedLines) {
  return exportedTypeBlocks(source)
    .filter((b) => changedLines.some((l) => l >= b.start && l <= b.end))
    .map((b) => b.name);
}

/** New-file line numbers touched by a `git diff -U0` text. */
export function changedLinesOfDiff(diff) {
  const out = [];
  for (const m of diff.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = Number(m[1]);
    const count = m[2] === undefined ? 1 : Number(m[2]);
    // a pure deletion (count 0) is reported at the line before it: the lines either side of the cut are touched
    if (count === 0) out.push(start, start + 1);
    for (let k = 0; k < count; k++) out.push(start + k);
  }
  return out;
}

export function testsNaming(names, files) {
  if (names.length === 0) return [];
  const re = new RegExp(`(?<![\\w$])(?:${names.map((n) => n.replace(/[$]/g, '\\$')).join('|')})(?![\\w$])`);
  return files.filter((f) => re.test(f.text)).map((f) => f.path);
}

function git(...args) {
  return execFileSync('git', args, {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
}

function main(base) {
  const changed = git('diff', '--name-only', '--diff-filter=ACMR', base, '--', ':(glob)packages/*/src/**/*.ts', ':(glob)packages/*/src/**/*.vue')
    .split('\n').filter((f) => f && f.endsWith('.ts'));
  const names = new Set();
  for (const f of changed) {
    const lines = changedLinesOfDiff(git('diff', '-U0', base, '--', f));
    for (const n of changedTypeNames(readFileSync(f, 'utf8'), lines)) names.add(n);
  }
  const tests = git('ls-files', ':(glob)packages/*/test/**/*.test.ts').split('\n').filter(Boolean)
    .map((path) => ({path, text: readFileSync(path, 'utf8')}));
  for (const p of testsNaming([...names], tests)) console.log(p);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv[2] ?? 'origin/main');
