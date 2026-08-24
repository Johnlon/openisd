// A SKIP IS A FAIL — the unit-suite half of the rule. See the sibling
// no-skips-playwright.js for the reasoning; this one covers vitest.
//
// Catches `it.skip`, `describe.skip`, `it.todo`, and `ctx.skip()` called at runtime.
// `it.only` is caught too: vitest marks everything else skipped.

import type { Reporter } from 'vitest/node';

interface TaskLike {
  type: string;
  name: string;
  mode?: string;
  result?: { state?: string };
  file?: { name?: string };
  tasks?: TaskLike[];
}

/**
 * The ONE sanctioned skip: under `PRECOMMIT=1` (set only by scripts/hooks-local/pre-commit)
 * the born-red CHECKLIST gates skip themselves — their offence lists are the human's to-do
 * list, enforced at ci/health-check and A10's byte-identical allow-list check, so their
 * standing red must not block every commit. This reporter still REPORTS those skips loudly
 * (visibility is the point) but only fails the run on them outside PRECOMMIT. Any skip NOT
 * from one of the named checklist suites fails even under PRECOMMIT — this is not a general
 * skip licence.
 */
const CHECKLIST_SUITES = [
  'module-level globals — every export must be an explicit, currently-real grant',
  'no re-exports — a name is declared where it is exported',
];
const PRECOMMIT = process.env.PRECOMMIT === '1';

export default class NoSkipsReporter implements Reporter {
  private skipped: string[] = [];

  onFinished(files: TaskLike[] = []): void {
    const walk = (task: TaskLike, file: string, path: string[]): void => {
      const title = [...path, task.name].join(' > ');
      if (task.tasks?.length) {
        for (const child of task.tasks) walk(child, file, [...path, task.name]);
        return;
      }
      const state = task.result?.state ?? task.mode;
      if (state === 'skip' || state === 'todo' || task.mode === 'skip' || task.mode === 'todo') {
        this.skipped.push(`${file}  ${title}`);
      }
    };

    for (const file of files) {
      for (const task of file.tasks ?? []) walk(task, file.name ?? '<unknown>', []);
    }

    if (!this.skipped.length) return;
    const blocking = PRECOMMIT
      ? this.skipped.filter(s => !CHECKLIST_SUITES.some(name => s.includes(name)))
      : this.skipped;
    const deferred = this.skipped.length - blocking.length;
    if (deferred > 0) {
      console.error(`\n  ⚠ ${deferred} CHECKLIST-gate assertion(s) deferred under PRECOMMIT=1 — they run red in ci/health-check/A10.`);
    }
    if (!blocking.length) return;
    console.error(`\n  ✖ ${blocking.length} SKIPPED test(s) — a skip is a fail:\n`);
    for (const s of blocking) console.error(`      ${s}`);
    console.error('\n    Make them run, or delete them. Do not leave a test that proves nothing.\n');
    process.exitCode = 1;
  }
}
