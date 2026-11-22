// Which tests failed, by Playwright's outcome and not by result status (T815;
// bugs/BUG_20261115_suite-summary-reads-result-status-not-outcome.md).
//
// A `test.fail` test that fails as expected has result status `failed` but outcome `expected`; only `unexpected` is a
// failure (and a `test.fail` test that PASSES is unexpected). Main's red count was read as 67 when it was 59 real failures.
// Every tool that summarises a run counts through these two functions.

/** A telemetry `test-end` event (scripts/telemetry-reporter.mjs): `expected` is result.status === test.expectedStatus. */
export function isUnexpectedEvent(event) {
  // Playwright's report calls a test it skipped 'skipped' whatever its expected status; the reporter's `expected` is false for it
  // (a serial describe skips the rest after a failure), which is not a failure. Checked on a real run: fixtures/pw-run-*.
  if (event.status === 'skipped') return false;
  if (typeof event.expected === 'boolean') return !event.expected;
  return event.status !== 'passed' && event.status !== 'skipped'; // an event written before `expected` existed
}

/**
 * A test of the Playwright JSON report. The reporter writes the outcome as the TEST-level `status`
 * (expected | unexpected | flaky | skipped); there is no `outcome` key, and each result's `status` (passed | failed ...) is the
 * attempt's own, which is what a test.fail test gets wrong. Checked against a real report: packages/ui/test/scripts/fixtures/pw-report-sample.json.
 */
export function isUnexpectedReportTest(test) {
  if (typeof test.status !== 'string') throw new Error('report test has no test-level status; not a Playwright JSON report test');
  return test.status === 'unexpected';
}

/** Every test of a Playwright JSON report: {title, file, status, resultStatus (last attempt), unexpected}. */
export function reportTests(report) {
  const out = [];
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        out.push({title: spec.title, file: spec.file, status: t.status, resultStatus: t.results?.[t.results.length - 1]?.status, unexpected: isUnexpectedReportTest(t)});
      }
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of report.suites ?? []) walk(suite);
  return out;
}

/** The test-end events of a telemetry events.jsonl text. */
export function testEndEvents(text) {
  return text.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)).filter((e) => e.event === 'test-end');
}
