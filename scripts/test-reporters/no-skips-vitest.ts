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
    console.error(`\n  ✖ ${this.skipped.length} SKIPPED test(s) — a skip is a fail:\n`);
    for (const s of this.skipped) console.error(`      ${s}`);
    console.error('\n    Make them run, or delete them. Do not leave a test that proves nothing.\n');
    process.exitCode = 1;
  }
}
