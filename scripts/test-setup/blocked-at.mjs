// Vitest setup file: report WHERE the event loop is blocked, instead of letting a stuck test
// simply time out. A test that keeps making progress is never touched; only a loop held for
// longer than the threshold is reported, with the stack of the code that held it.
//
// Report only: nothing here fails a test. OFF by default: blocked-at hooks every async resource
// and captures a stack for each, which made one 85-test file take 30 s instead of 9.6 s (12 Oct),
// and with isolate off it was installed again per file, so a full run slowed as it went.
// On with OPENISD_BLOCKED_AT=1; the threshold is OPENISD_BLOCKED_AT_MS (default 1000).
// Installed once per worker, whatever the number of files the worker runs.
import blockedAt from 'blocked-at';

const INSTALLED = Symbol.for('openisd.blockedAt');
if (process.env.OPENISD_BLOCKED_AT === '1' && !Reflect.get(globalThis, INSTALLED)) {
  Reflect.set(globalThis, INSTALLED, true);
  const threshold = Number(process.env.OPENISD_BLOCKED_AT_MS) || 1000;
  blockedAt((ms, stack) => {
    const frames = stack.filter(f => !f.includes('blocked-at') && !f.includes('node:internal'));
    process.stderr.write(`\n[blocked-at] event loop blocked for ${Math.round(ms)} ms, started at:\n${frames.slice(0, 12).join('\n')}\n`);
  }, { threshold });
}
