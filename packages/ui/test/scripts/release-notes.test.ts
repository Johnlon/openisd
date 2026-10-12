/**
 * `scripts/hosting/releaseNotes.mjs` — user-facing release notes from the commits since the last
 * release. What it pins: commits map to tasks by subject prefix and by touched task files; New and
 * Fixed sections; resolved bugs add their symptom; duplicates collapse; internal work is counted,
 * never described; and no hash or id ever reaches the output.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {bugSentenceOf, headlineOf, leaks, notesOf, releaseNoteOf, taskKeysOf} from '../../../../scripts/hosting/releaseNotes.mjs';

const TASKS: Record<string, string> = {
  T012: 'id: T012\nrelease_note: "Bandpass boxes are available."\ngoal: x\n',
  T013: 'id: T013\nrelease_note: internal\n',
  T014: 'id: T014\nrelease_note: "Bandpass boxes are available."\n',
  T015: 'id: T015\nrelease_note: "Dialogs are clearer."\n',
  T016: 'id: T016\nrelease_note: "Fixed in T012 by abc1234def."\n',
  T017: 'id: T017\ngoal: no note\n',
  'F5-fix': 'id: F5-fix\nrelease_note: "The loading icon no longer blocks clicks."\n',
};
const BUG = '# BUG_x\n\n**Status:** RESOLVED\n\n## Symptom\nClearing a field stores 0. The user never typed it.\n\n## Cause\nx\n';
const readTask = (k: string): string | null => TASKS[k] ?? null;
const readBug = (p: string): string | null => (p === 'bugs/BUG_x.md' ? BUG : p === 'bugs/BUG_open.md' ? BUG.replace('RESOLVED', 'OPEN') : null);

describe('taskKeysOf', () => {
  it('reads the ids a subject starts with', () => {
    assert.deepEqual(taskKeysOf('T012: wizard'), ['T012']);
    assert.deepEqual(taskKeysOf('(auto) T055/T056: x'), ['T055', 'T056']);
    assert.deepEqual(taskKeysOf('T055 T056 T058: x'), ['T055', 'T056', 'T058']);
    assert.deepEqual(taskKeysOf('F5: loading'), ['F5-fix']);
    assert.deepEqual(taskKeysOf('Merge branch x'), []);
  });
});

describe('releaseNoteOf / bugSentenceOf / headlineOf', () => {
  it('takes the quoted sentence; internal and absent give null', () => {
    assert.equal(releaseNoteOf(TASKS.T012 ?? ''), 'Bandpass boxes are available.');
    assert.equal(releaseNoteOf(TASKS.T013 ?? ''), null);
    assert.equal(releaseNoteOf(TASKS.T017 ?? ''), null);
  });

  it('takes the first Symptom sentence of a resolved bug only', () => {
    assert.equal(bugSentenceOf(BUG), 'Clearing a field stores 0.');
    assert.equal(bugSentenceOf(BUG.replace('RESOLVED', 'OPEN')), null);
  });

  it('the headline is the first bullet, skipping headings', () => {
    assert.equal(headlineOf('## New\n\n- First thing.\n- Second.\n'), 'First thing.');
    assert.equal(headlineOf('Internal changes only (3).\n'), 'Internal changes only (3).');
  });
});

describe('notesOf', () => {
  it('groups New and Fixed, counts internal work, and prints no id or hash', () => {
    const md = notesOf([
      {subject: '(auto) T012: wizard', files: ['a.ts']},
      {subject: 'T013: gates', files: []},
      {subject: 'F5: loading', files: []},
      {subject: 'tidy docs', files: ['README.md']},
      {subject: 'Fix clearing', files: ['bugs/BUG_x.md']},
    ], readTask, readBug);
    assert.equal(md, [
      '## New', '', '- Bandpass boxes are available.', '',
      '## Fixed', '', '- The loading icon no longer blocks clicks.', '- Clearing a field stores 0.', '',
      'and 2 internal changes.', '',
    ].join('\n'));
    assert.equal(leaks(md), false);
  });

  it('maps a commit to a task by the task file it touched', () => {
    const md = notesOf([{subject: 'dialogs', files: ['tasks/T015.yml']}], readTask, readBug);
    assert.ok(md.includes('- Dialogs are clearer.'));
  });

  it('collapses duplicate sentences', () => {
    const md = notesOf([{subject: 'T012: a', files: []}, {subject: 'T014: b', files: []}], readTask, readBug);
    assert.equal(md.match(/Bandpass boxes/g)?.length, 1);
  });

  it('drops a sentence that holds an id or a hash, and counts that commit as internal', () => {
    const md = notesOf([{subject: 'T016: x', files: []}], readTask, readBug);
    assert.ok(!md.includes('T012') && !md.includes('abc1234'));
    assert.equal(md, 'Internal change only (1).\n');
  });

  it('treats a task with no note, an unknown task and an open bug as internal', () => {
    const md = notesOf([
      {subject: 'T017: x', files: []}, {subject: 'T999: y', files: []}, {subject: 'z', files: ['bugs/BUG_open.md']},
    ], readTask, readBug);
    assert.equal(md, 'Internal changes only (3).\n');
  });

  it('says so when nothing changed', () => {
    assert.equal(notesOf([], readTask, readBug), 'No changes.\n');
  });
});

describe('leaks', () => {
  it('flags task ids, question ids and hashes, not ordinary words', () => {
    for (const bad of ['see T012.', 'fixes F5', 'QO177 says', 'commit 009cb130', 'abc1234def']) assert.equal(leaks(bad), true, bad);
    for (const ok of ['Effaced text', 'Bandpass 6th-order boxes', 'Sd 143 cm2', 'v20260101T0102Z']) assert.equal(leaks(ok), false, ok);
  });
});
