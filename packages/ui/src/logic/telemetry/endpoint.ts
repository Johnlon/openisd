import type {TelemetryEnvironment} from './events.js';

/** Where usage events go. */
export const TELEMETRY_ENDPOINT = 'https://openisd-stats.john-lonergan-0e9.workers.dev/e';
const PRODUCTION_HOSTNAME = 'openisd.app';
const TEST_HOSTNAME = 'test.openisd.app';

export interface EndpointChoice {
  readonly hostname: string;
  /** Vite mode; the browser suite builds with `test`. */
  readonly mode: string;
  /** The browser suite's switch for the one spec that exercises telemetry. */
  readonly testOptIn: boolean;
}

/** Where events go and which environment they say they come from. */
export interface TelemetryTarget {
  readonly endpoint: string;
  readonly environment: TelemetryEnvironment;
}

/** The collector and environment, or null where nothing may be sent: localhost, other hosts, and
 *  the browser suite unless a spec opts in (its events say `test`). The environment is derived here,
 *  once, from the hostname. The collector accepts openisd.app and test.openisd.app. */
export function chooseEndpoint(c: EndpointChoice): TelemetryTarget | null {
  if (c.mode === 'test') return c.testOptIn ? {endpoint: TELEMETRY_ENDPOINT, environment: 'test'} : null;
  switch (c.hostname) {
    case PRODUCTION_HOSTNAME: return {endpoint: TELEMETRY_ENDPOINT, environment: 'production'};
    case TEST_HOSTNAME: return {endpoint: TELEMETRY_ENDPOINT, environment: 'test'};
    default: return null;
  }
}
