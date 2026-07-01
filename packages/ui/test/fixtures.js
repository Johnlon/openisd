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
export const test = base.extend({
  browserLog: [async ({ page }, use, testInfo) => {
    const log = { consoleErrors: [], consoleWarnings: [], pageErrors: [], networkErrors: [] };
    log.reset = () => {
      for (const k of ['consoleErrors', 'consoleWarnings', 'pageErrors', 'networkErrors']) log[k].length = 0;
    };

    page.on('console', m => {
      if (m.type() === 'error') log.consoleErrors.push(m.text());
      else if (m.type() === 'warning') log.consoleWarnings.push(m.text());
    });
    page.on('pageerror', e => log.pageErrors.push(e.message));
    page.on('requestfailed', r => {
      // external federated sources (github.com) may be unreachable in CI — not our bug
      if (r.url().includes('localhost')) log.networkErrors.push(`FAILED ${r.url()} — ${r.failure()?.errorText}`);
    });
    page.on('response', r => {
      if (r.url().includes('localhost') && r.status() >= 400) log.networkErrors.push(`${r.status()} ${r.url()}`);
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

    // NO opt-out, NO skip-on-failure. Every test asserts the browser stayed clean,
    // always — even alongside an existing failure, so browser-side evidence is never
    // swallowed. (Clean logs make these assertions no-ops.)
    const dupKeys = log.consoleWarnings.filter(w => /duplicate key/i.test(w));
    expect(dupKeys, 'Vue "Duplicate keys found" warnings').toEqual([]);
    expect(log.consoleErrors, 'console errors during test').toEqual([]);
    expect(log.pageErrors, 'uncaught page errors during test').toEqual([]);
    expect(log.networkErrors, 'same-origin network failures during test').toEqual([]);
  }, { auto: true }],
});

export { expect };
