import {NoTelemetry} from '../../src/logic/telemetry/telemetry.js';
import {deviceFactsOf, PerfReporter} from '../../src/logic/telemetry/perf.js';

/** A perf reporter that sends nothing: for tests that are not about timings. */
export function silentPerf(): PerfReporter {
  return new PerfReporter({telemetry: new NoTelemetry(), now: () => 0, afterPaint: () => undefined, skin: () => 'original', device: deviceFactsOf({})});
}
