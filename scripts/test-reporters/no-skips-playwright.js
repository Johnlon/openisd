// A SKIP IS A FAIL. This reporter makes the browser suite red if any test did not run.
//
// Why it is a gate and not a preference: a skipped test reports success while proving
// nothing. The skip that prompted this rule (`test.fixme` on the driver-library search
// spec) hid the fact that the app was shipping ZERO drivers — the suite stayed green for
// as long as the feature was completely broken.
//
// Catches every form: `test.skip()`, `test.fixme()`, conditional `test.skip(cond)`, a
// skipped `describe`, and `test.only` elsewhere silently skipping the rest.
//
// If a test genuinely cannot run yet, DELETE it — a test that never executes is not a
// test, and git holds it if it is ever wanted back.

export default class NoSkipsReporter {
  constructor() {
    this.skipped = [];
  }

  onTestEnd(test, result) {
    if (result.status === 'skipped') {
      this.skipped.push(`${test.location.file.replace(process.cwd() + '/', '')}:${test.location.line}  ${test.title}`);
    }
  }

  async onEnd() {
    if (!this.skipped.length) return;
    console.error(`\n  ✖ ${this.skipped.length} SKIPPED test(s) — a skip is a fail:\n`);
    for (const s of this.skipped) console.error(`      ${s}`);
    console.error('\n    Make them run, or delete them. Do not leave a test that proves nothing.\n');
    return { status: 'failed' };
  }
}
