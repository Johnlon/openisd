/**
 * telemetry-reporter.mjs — one JSON line per test event, readable WHILE the run is going.
 *
 * Written for analysing a sequential full-suite run: which specs are slow, which fail, and how
 * that lines up against scripts/telemetry-sampler.mjs's memory samples on the same clock.
 *
 * Every line is appended with appendFileSync — no buffering, no batching — because the point is
 * to read build/ui-telemetry/events.jsonl mid-run. A run that dies still leaves every event up
 * to the moment it died, which a reporter writing at onEnd would not.
 *
 * Line shape (one JSON object per line):
 *   {t, event:'run-begin'|'test-begin'|'test-end'|'run-end', file, line, title, status,
 *    expected, durationMs, retry, errorFirstLine, stepCount, workerIndex, workerPid, runnerPid}
 *
 * workerPid is null BY DESIGN: Playwright runs reporters in the main process and exposes no
 * worker pid to them, so workerIndex is the field that identifies the worker. runnerPid is this
 * process — what the sampler sees as the playwright runner.
 */
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, relative } from 'node:path';

const OUT = process.env.OPENISD_TELEMETRY_EVENTS ?? 'build/ui-telemetry/events.jsonl';
// Playwright colours its error messages; the escape sequences would make the jsonl unreadable.
const ANSI = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');

function firstLine(text) {
  if (!text) return null;
  return String(text).replace(ANSI, '').split('\n')[0].slice(0, 300);
}

export default class TelemetryReporter {
  onBegin(config, suite) {
    mkdirSync(dirname(OUT), { recursive: true });
    this.root = config.rootDir;
    this.total = suite.allTests().length;
    this.done = 0;
    this.write({ event: 'run-begin', total: this.total, workers: config.workers });
  }

  onTestBegin(test, result) {
    this.write({
      event: 'test-begin',
      ...this.identity(test),
      retry: result.retry,
      workerIndex: result.workerIndex,
    });
  }

  onTestEnd(test, result) {
    this.done += 1;
    this.write({
      event: 'test-end',
      ...this.identity(test),
      status: result.status,
      expected: result.status === test.expectedStatus,
      durationMs: result.duration,
      retry: result.retry,
      errorFirstLine: firstLine(result.error?.message),
      stepCount: result.steps?.length ?? 0,
      workerIndex: result.workerIndex,
      done: this.done,
      total: this.total,
    });
  }

  onEnd(result) {
    this.write({ event: 'run-end', status: result.status, durationMs: result.duration });
  }

  identity(test) {
    return {
      file: relative(this.root ?? process.cwd(), test.location.file),
      line: test.location.line,
      // titlePath() is [project, file, ...describes, title]; drop the first three so the label
      // is the describe chain plus the test name, matching how the list reporter reads.
      title: test.titlePath().slice(3).join(' > ') || test.title,
    };
  }

  write(fields) {
    appendFileSync(OUT, JSON.stringify({
      t: new Date().toISOString(),
      runnerPid: process.pid,
      workerPid: null,
      ...fields,
    }) + '\n');
  }
}
