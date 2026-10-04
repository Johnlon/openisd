// Vitest setup file: report WHERE the event loop is blocked, instead of letting a stuck test
// simply time out. A test that keeps making progress is never touched; only a loop held for
// longer than the threshold is reported, with the stack of the code that held it.
//
// Report only: nothing here fails a test. Off with OPENISD_BLOCKED_AT=0; the threshold is
// OPENISD_BLOCKED_AT_MS (default 1000).
import blockedAt from 'blocked-at';

if (process.env.OPENISD_BLOCKED_AT !== '0') {
  const threshold = Number(process.env.OPENISD_BLOCKED_AT_MS) || 1000;
  blockedAt((ms, stack) => {
    const frames = stack.filter(f => !f.includes('blocked-at') && !f.includes('node:internal'));
    process.stderr.write(`\n[blocked-at] event loop blocked for ${Math.round(ms)} ms, started at:\n${frames.slice(0, 12).join('\n')}\n`);
  }, { threshold });
}
