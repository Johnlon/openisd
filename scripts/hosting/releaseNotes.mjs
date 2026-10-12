#!/usr/bin/env node
// Release notes for users: what changed, in plain sentences, from the commits since the last release.
// No hashes, no task or fix ids, no branch or agent names, nothing internal.
//
// A commit maps to a task by the T/F id at the start of its subject ("T012: ...", "(auto) F5: ...",
// "T055/T056: ...") and by the tasks/*.yml files it touched. The task file's `release_note:` is the
// sentence (the word `internal` means none). A bug file under bugs/ touched in the range, whose
// status is RESOLVED, adds the first sentence of its Symptom to Fixed. A commit with no task and no
// bug counts as an internal change.
//
//   node scripts/hosting/releaseNotes.mjs notes <from> <to>   markdown for the commits in from..to
//                                                             (<from> may be empty: the last 30)
//   node scripts/hosting/releaseNotes.mjs headline            first note of the markdown on stdin
import {execFileSync} from 'node:child_process';
import {existsSync, readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const LEADING_IDS = /^(?:\(auto\)\s+)?((?:[TF]\d+[\s,/&]*)+):/;
const TASK_FILE = /^tasks\/((?:T\d+)|(?:F\d+-fix))\.yml$/;
const BUG_FILE = /^bugs\/BUG_[^/]+\.md$/;
// A task id, a quoted question id, or a hash (hex with at least one digit).
const LEAK = /(?:^|[^A-Za-z0-9])(?:[TFQ][A-Z]?\d{1,4}|(?=[0-9a-f]*\d)[0-9a-f]{7,40})(?:[^A-Za-z0-9]|$)/;

/** True when `text` holds something a user must not see: an id or a hash. */
export function leaks(text) {
  return LEAK.test(text);
}

/** Task file keys named by a commit subject: "T055/T056: x" is ["T055", "T056"]; F5 is "F5-fix". */
export function taskKeysOf(subject) {
  const m = LEADING_IDS.exec(subject);
  if (!m) return [];
  return [...m[1].matchAll(/[TF]\d+/g)].map(x => (x[0].startsWith('F') ? `${x[0]}-fix` : x[0]));
}

/** The release_note sentence of a task file's text; null for `internal` or when absent. */
export function releaseNoteOf(taskText) {
  const m = /^release_note:[ \t]*(.*)$/m.exec(taskText);
  if (!m) return null;
  const raw = m[1].trim();
  if (raw === '' || raw === 'internal') return null;
  return raw.replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"');
}

/** The first sentence of a resolved bug file's Symptom; null when the bug is not resolved or has none. */
export function bugSentenceOf(bugText) {
  if (!/^\*\*Status:\*\*\s*RESOLVED/mi.test(bugText)) return null;
  const m = /^## Symptom\s*\n([\s\S]*?)(?:\n\s*\n|\n## |$)/m.exec(bugText);
  if (!m) return null;
  const paragraph = m[1].replace(/\s+/g, ' ').trim();
  const sentence = /^.*?[.!?](?=\s|$)/.exec(paragraph)?.[0] ?? paragraph;
  return sentence === '' ? null : sentence;
}

/**
 * Markdown notes for `commits` ({subject, files}). `readTask(key)` and `readBug(path)` return a
 * file's text or null. Sections are New (T tasks) and Fixed (F tasks and resolved bugs); a line that
 * would leak an id or a hash is dropped and counted as internal.
 */
export function notesOf(commits, readTask, readBug) {
  const added = [];
  const fixed = [];
  const seen = new Set();
  let internal = 0;
  const add = (list, sentence) => {
    if (leaks(sentence)) return false;
    if (!seen.has(sentence)) { seen.add(sentence); list.push(sentence); }
    return true;
  };
  for (const c of commits) {
    const keys = new Set(taskKeysOf(c.subject));
    for (const f of c.files) { const m = TASK_FILE.exec(f); if (m) keys.add(m[1]); }
    let covered = false;
    for (const key of keys) {
      const text = readTask(key);
      const note = text === null ? null : releaseNoteOf(text);
      if (note !== null && add(key.startsWith('F') ? fixed : added, note)) covered = true;
    }
    for (const f of c.files.filter(x => BUG_FILE.test(x))) {
      const text = readBug(f);
      const sentence = text === null ? null : bugSentenceOf(text);
      if (sentence !== null && add(fixed, sentence)) covered = true;
    }
    if (!covered) internal++;
  }
  const parts = [];
  if (added.length > 0) parts.push(`## New\n\n${added.map(s => `- ${s}`).join('\n')}`);
  if (fixed.length > 0) parts.push(`## Fixed\n\n${fixed.map(s => `- ${s}`).join('\n')}`);
  const plural = internal === 1 ? 'change' : 'changes';
  if (internal > 0) parts.push(added.length + fixed.length > 0 ? `and ${internal} internal ${plural}.` : `Internal ${plural} only (${internal}).`);
  if (parts.length === 0) parts.push('No changes.');
  const markdown = `${parts.join('\n\n')}\n`;
  if (leaks(markdown)) throw new Error('release notes would leak an id or a hash');
  return markdown;
}

/** The first line of notes a person reads: the first bullet, else the first plain line. */
export function headlineOf(markdown) {
  for (const raw of markdown.split('\n')) {
    const line = raw.trim().replace(/^-\s+/, '');
    if (line !== '' && !line.startsWith('#')) return line;
  }
  return '';
}

/** The commits in from..to (no merges), as {subject, files}. */
export function commitsIn(from, to) {
  const range = from === '' ? ['-n', '30', to] : [`${from}..${to}`];
  const out = execFileSync('git', ['log', '--no-merges', '--format=%x1e%s', '--name-only', ...range], {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024});
  return out.split('\x1e').filter(b => b.trim() !== '').map(block => {
    const [subject, ...rest] = block.split('\n');
    return {subject: subject.trim(), files: rest.map(l => l.trim()).filter(l => l !== '')};
  });
}

const readIfThere = path => (existsSync(path) ? readFileSync(path, 'utf8') : null);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [mode, from, to] = process.argv.slice(2);
  if (mode === 'notes' && from !== undefined && to) {
    process.stdout.write(notesOf(commitsIn(from, to), key => readIfThere(`tasks/${key}.yml`), readIfThere));
  } else if (mode === 'headline') {
    process.stdout.write(`${headlineOf(readFileSync(0, 'utf8'))}\n`);
  } else {
    console.error('usage: releaseNotes.mjs notes <from> <to> | headline');
    process.exit(2);
  }
}
