/**
 * BUG_20261115_suite-summary-reads-result-status-not-outcome: a `test.fail` test that fails as expected has result status
 * `failed` but test outcome `expected`; only `unexpected` is a failure. The summary tools count by outcome.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isUnexpectedEvent, isUnexpectedReportTest, reportTests, testEndEvents} from '../../../../scripts/lib/testOutcome.mjs';

describe('isUnexpectedEvent (telemetry test-end events)', () => {
  it('does not count a test.fail test that failed as expected', () => {
    assert.equal(isUnexpectedEvent({status: 'failed', expected: true}), false);
  });
  it('counts a plain failure, a timeout and a test.fail test that passed', () => {
    assert.equal(isUnexpectedEvent({status: 'failed', expected: false}), true);
    assert.equal(isUnexpectedEvent({status: 'timedOut', expected: false}), true);
    assert.equal(isUnexpectedEvent({status: 'passed', expected: false}), true);
  });
  it('does not count a pass or a skip', () => {
    assert.equal(isUnexpectedEvent({status: 'passed', expected: true}), false);
    assert.equal(isUnexpectedEvent({status: 'skipped', expected: true}), false);
  });
  it('falls back to the status for an old event with no expected field', () => {
    assert.equal(isUnexpectedEvent({status: 'failed'}), true);
    assert.equal(isUnexpectedEvent({status: 'passed'}), false);
  });
});

describe('the Playwright JSON report', () => {
  // A real sample, not a hand-written one: tests cut from main's own suite reports (fixtures/pw-report-sample.json).
  // Playwright's JSON reporter writes the outcome as the test-level `status` (expected|unexpected|flaky|skipped), and no `outcome` key.
  const report: unknown = JSON.parse(readFileSync(new URL('./fixtures/pw-report-sample.json', import.meta.url), 'utf8'));
  const tests = reportTests(report);

  it('finds every test of the report with the result status of its last attempt', () => {
    assert.deepEqual(tests.map((t) => t.resultStatus), ['passed', 'failed', 'failed']);
  });
  it('does not count a test.fail test that failed as expected, though its result status is failed', () => {
    const expectedFail = tests.find((t) => t.title.startsWith('every number box on box-vented'));
    assert.equal(expectedFail?.resultStatus, 'failed');
    assert.equal(expectedFail?.unexpected, false);
  });
  it('counts the test whose test status is unexpected, and only that one', () => {
    assert.deepEqual(tests.filter((t) => t.unexpected).map((t) => t.title), ['under 8 px nothing changes, and a click selects one digit']);
  });
  it('counts a test.fail test that passed (test status unexpected) as a failure', () => {
    assert.equal(isUnexpectedReportTest({status: 'unexpected', results: [{status: 'passed'}]}), true);
  });
  it('does not count flaky or skipped tests', () => {
    assert.equal(isUnexpectedReportTest({status: 'flaky', results: [{status: 'failed'}, {status: 'passed'}]}), false);
    assert.equal(isUnexpectedReportTest({status: 'skipped', results: [{status: 'skipped'}]}), false);
  });
  it('refuses a report test with no status instead of guessing from a result', () => {
    assert.throws(() => isUnexpectedReportTest({results: [{status: 'failed'}]}), /no test-level status/);
  });
});

describe('the event path and the report path agree on one real run', () => {
  // fixtures/pw-run-report.json and pw-run-events.jsonl are the json reporter's and scripts/telemetry-reporter.mjs's output for the
  // SAME run: a plain pass, a test.fail that fails, a test.fail that passes, and a serial describe whose first test fails
  // (Playwright then SKIPS the rest, and the telemetry event for a skipped test says expected:false, which is not a failure).
  const report = reportTests(JSON.parse(readFileSync(new URL('./fixtures/pw-run-report.json', import.meta.url), 'utf8')));
  const events = testEndEvents(readFileSync(new URL('./fixtures/pw-run-events.jsonl', import.meta.url), 'utf8'));

  it('has the same tests in both', () => {
    assert.deepEqual(events.map((e) => e.title).sort(), report.map((t) => t.title).sort());
  });
  it('calls each test a failure or not in the same way', () => {
    for (const e of events) {
      assert.equal(isUnexpectedEvent(e), report.find((t) => t.title === e.title)?.unexpected, e.title);
    }
  });
  it('counts exactly the plain failure and the test.fail that passed', () => {
    assert.deepEqual(events.filter((e) => isUnexpectedEvent(e)).map((e) => e.title).sort(), ['expected failure that passes', 'first fails']);
  });
  it('does not count a test skipped after an earlier failure in a serial describe', () => {
    assert.equal(isUnexpectedEvent({status: 'skipped', expected: false}), false);
  });
});
