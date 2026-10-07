/**
 * Waits out a Chrome launch outage. Under WSL2 Chrome sometimes aborts itself for about 40 s,
 * and every launch in that window fails within milliseconds
 * (bugs/BUG_20261007_browser-processes-die-mid-suite.md). A launch is not a test result, so it
 * is retried here; a test body is never retried.
 */
export interface OutageClock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export interface OutagePolicy {
  /** How long to keep retrying; 0 means one attempt. */
  readonly timeoutMs: number;
  readonly retryDelayMs: number;
}

export const CHROME_OUTAGE_POLICY: OutagePolicy = {timeoutMs: 180_000, retryDelayMs: 1_000};

/**
 * A burst flips between launched and dead every 1-3 s, so one good page load proves nothing. A
 * launch counts once Chrome has stayed up this long and loaded a second page.
 */
export const CHROME_STABLE_MS = 3_000;

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Runs `attempt` until it succeeds, sleeping `retryDelayMs` between failures. Each failure and the
 * recovery are logged as a `CHROME-OUTAGE` line. After `timeoutMs` the last error is thrown.
 */
export async function waitOutOutage<T>(
  attempt: () => Promise<T>,
  policy: OutagePolicy,
  clock: OutageClock,
  log: (line: string) => void,
): Promise<T> {
  const started = clock.now();
  let attempts = 0;
  for (;;) {
    attempts += 1;
    try {
      const result = await attempt();
      if (attempts > 1) {
        log(`CHROME-OUTAGE over after ${Math.round((clock.now() - started) / 1000)} s (${attempts} attempts)`);
      }
      return result;
    } catch (error) {
      const waited_ms = clock.now() - started;
      if (waited_ms >= policy.timeoutMs) {
        if (attempts > 1) log(`CHROME-OUTAGE gave up after ${Math.round(waited_ms / 1000)} s (${attempts} attempts)`);
        throw error;
      }
      log(`CHROME-OUTAGE launch failed (attempt ${attempts}): ${messageOf(error)}; retrying`);
      await clock.sleep(policy.retryDelayMs);
    }
  }
}
