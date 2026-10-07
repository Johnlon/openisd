import {describe, expect, it} from 'vitest';
import {type OutageClock, type OutagePolicy, waitOutOutage} from './chromeOutage.js';

/** A clock that only moves when `sleep` is called, so a 90 s wait takes no real time. */
class FakeClock implements OutageClock {
  elapsed_ms = 0;

  now(): number {
    return this.elapsed_ms;
  }

  async sleep(ms: number): Promise<void> {
    this.elapsed_ms += ms;
  }
}

const POLICY: OutagePolicy = {timeoutMs: 90_000, retryDelayMs: 1_000};  // the test's own policy, not CHROME_OUTAGE_POLICY

/** An attempt that fails `failures` times and then returns `value`. */
function failsThenSucceeds<T>(failures: number, value: T): {attempt: () => Promise<T>; calls: () => number} {
  let calls = 0;
  return {
    calls: () => calls,
    attempt: async () => {
      calls += 1;
      if (calls <= failures) throw new Error(`launch failed ${calls}`);
      return value;
    },
  };
}

describe('waitOutOutage', () => {
  it('returns the first success without logging', async () => {
    const lines: string[] = [];
    const run = failsThenSucceeds(0, 'browser');
    expect(await waitOutOutage(run.attempt, POLICY, new FakeClock(), line => lines.push(line))).toBe('browser');
    expect(run.calls()).toBe(1);
    expect(lines).toEqual([]);
  });

  it('simulated launch failure, then success: retries, logs CHROME-OUTAGE, returns the browser', async () => {
    const lines: string[] = [];
    const clock = new FakeClock();
    const run = failsThenSucceeds(3, 'browser');
    expect(await waitOutOutage(run.attempt, POLICY, clock, line => lines.push(line))).toBe('browser');
    expect(run.calls()).toBe(4);
    expect(clock.elapsed_ms).toBe(3_000);
    expect(lines.filter(l => l.startsWith('CHROME-OUTAGE') && l.includes('launch failed'))).toHaveLength(3);
    expect(lines[0]).toContain('launch failed 1');
    expect(lines.at(-1)).toContain('over after 3 s');
    expect(lines.at(-1)).toContain('4 attempts');
  });

  it('a permanent failure throws the last error once the wait is spent', async () => {
    const lines: string[] = [];
    const clock = new FakeClock();
    const run = failsThenSucceeds(Number.MAX_SAFE_INTEGER, 'never');
    const thrown = await waitOutOutage(run.attempt, POLICY, clock, line => lines.push(line)).then(
      () => null,
      (error: unknown) => error,
    );
    expect(thrown).toEqual(new Error(`launch failed ${run.calls()}`));
    expect(clock.elapsed_ms).toBeGreaterThanOrEqual(POLICY.timeoutMs);
    expect(clock.elapsed_ms).toBeLessThan(POLICY.timeoutMs + POLICY.retryDelayMs);
    expect(run.calls()).toBe(POLICY.timeoutMs / POLICY.retryDelayMs + 1);
    expect(lines.at(-1)).toContain('gave up after 90 s');
  });

  it('a wait of zero never retries', async () => {
    const run = failsThenSucceeds(1, 'browser');
    await expect(waitOutOutage(run.attempt, {timeoutMs: 0, retryDelayMs: 1_000}, new FakeClock(), () => {})).rejects.toThrow(
      'launch failed 1',
    );
    expect(run.calls()).toBe(1);
  });
});
