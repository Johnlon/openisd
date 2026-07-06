import { test as base, expect } from '@playwright/test';

/**
 * Shared Playwright fixtures for all UI/browser tests.
 *
 * `browserLog` is an AUTO fixture — it runs for every test that imports `test`
 * from here, even if the test never references it. It:
 *   1. Establishes a clean baseline at test start (fresh per-test page, empty log).
 *   2. Captures the browser Console, uncaught page errors, and same-origin Network
 *      failures for the whole test.
 *   3. At teardown asserts NO NEW issues appeared (only if the test body passed).
 *
 * This makes the CLAUDE.md rule ("UI tests MUST assert zero console/network
 * issues") impossible to forget — a green DOM assertion alone once hid a Vue
 * "Duplicate keys found" warning that was corrupting list rendering.
 *
 * Baseline control: a test may call `browserLog.reset()` after its initial
 * navigation/setup to re-baseline, so only issues from its own interactions are
 * asserted. Add `browserLog` to the test args to use it.
 *
 * Asserted for EVERY test (no opt-out): no console `error`s, no "Duplicate keys"
 * class of Vue warning, no uncaught page errors, no 4xx/5xx/failed localhost
 * requests. Benign general warnings (e.g. "Autofocus processing was blocked")
 * are NOT failed. On any failure the full console + network capture is attached
 * to the report and printed for diagnosis.
 */
export interface BrowserLog {
  consoleErrors: string[];
  consoleWarnings: string[];
  pageErrors: string[];
  networkErrors: string[];
  reset: () => void;
}

export const test = base.extend<{ browserLog: BrowserLog }>({
  browserLog: [async ({ page }, use, testInfo) => {
    const log: BrowserLog = {
      consoleErrors: [], consoleWarnings: [], pageErrors: [], networkErrors: [],
      reset: () => {
        for (const k of ['consoleErrors', 'consoleWarnings', 'pageErrors', 'networkErrors'] as const) log[k].length = 0;
      },
    };

    // Cross-origin federated driver sources (github.com) may 404/be unreachable in
    // CI/sandboxed environments — not our bug. Each such failed fetch also logs the
    // browser's generic native "Failed to load resource" console error, which is
    // otherwise indistinguishable from a real app-caused console error; tolerate
    // exactly as many of those generic messages as we saw non-localhost failures.
    const GENERIC_RESOURCE_FAIL = /^Failed to load resource: the server responded with a status of \d+/;
    let toleratedResourceFailures = 0;

    page.on('console', m => {
      if (m.type() === 'error') log.consoleErrors.push(m.text());
      else if (m.type() === 'warning') log.consoleWarnings.push(m.text());
    });
    page.on('pageerror', e => log.pageErrors.push(e.message));
    page.on('requestfailed', r => {
      // external federated sources (github.com) may be unreachable in CI — not our bug
      if (r.url().includes('localhost')) log.networkErrors.push(`FAILED ${r.url()} — ${r.failure()?.errorText}`);
      else toleratedResourceFailures++;
    });
    page.on('response', r => {
      if (r.status() < 400) return;
      if (r.url().includes('localhost')) log.networkErrors.push(`${r.status()} ${r.url()}`);
      else toleratedResourceFailures++;
    });

    await use(log);

    const dump = {
      consoleErrors: log.consoleErrors,
      consoleWarnings: log.consoleWarnings,
      pageErrors: log.pageErrors,
      networkErrors: log.networkErrors,
    };
    const failed = testInfo.status !== testInfo.expectedStatus;
    const hasIssues = Object.values(dump).some(a => a.length > 0);

    // Always collect the evidence: whenever a test failed (any reason) OR the
    // browser logged anything, attach the captured console + network to the report
    // and print it — like an error trace, for diagnosis.
    if (failed || hasIssues) {
      await testInfo.attach('browser-console-and-network', {
        body: JSON.stringify(dump, null, 2),
        contentType: 'application/json',
      });
      console.error(`\n[browser diagnostics — "${testInfo.title}"${failed ? ' (test FAILED)' : ''}]\n${JSON.stringify(dump, null, 2)}\n`);
    }

    // Drop up to `toleratedResourceFailures` generic "Failed to load resource"
    // console messages — each one traces back to a tolerated non-localhost 4xx/5xx
    // (see the response/requestfailed listeners above), not an app bug.
    let remainingTolerated = toleratedResourceFailures;
    const consoleErrors = log.consoleErrors.filter(e => {
      if (remainingTolerated > 0 && GENERIC_RESOURCE_FAIL.test(e)) { remainingTolerated--; return false; }
      return true;
    });

    // NO opt-out, NO skip-on-failure. EVERY check runs every time — each is wrapped
    // in try/catch so an early failure never prevents the later checks from running.
    // Their failures are aggregated into ONE error listing every category, so a
    // single test run reports the complete picture rather than the first problem only.
    const checks: Array<[string, string[]]> = [
      ['Vue "Duplicate keys found" warnings', log.consoleWarnings.filter(w => /duplicate key/i.test(w))],
      ['console errors', consoleErrors],
      ['uncaught page errors', log.pageErrors],
      ['same-origin network failures', log.networkErrors],
    ];
    const failures: string[] = [];
    for (const [label, entries] of checks) {
      try {
        expect(entries, label).toEqual([]);
      } catch {
        failures.push(`✗ ${label} (${entries.length}):\n    ${entries.join('\n    ')}`);
      }
    }
    if (failures.length) {
      throw new Error(`Browser diagnostics not clean — ${failures.length} categor${failures.length === 1 ? 'y' : 'ies'} with issues:\n${failures.join('\n')}`);
    }
  }, { auto: true }],
});

export { expect };
