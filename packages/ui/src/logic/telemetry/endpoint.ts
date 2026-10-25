/** Where usage events go. */
export const TELEMETRY_ENDPOINT = 'https://openisd-stats.john-lonergan-0e9.workers.dev/e';
const TELEMETRY_HOSTNAME = 'openisd.app';

export interface EndpointChoice {
  readonly hostname: string;
  /** Vite mode; the browser suite builds with `test`. */
  readonly mode: string;
  /** The browser suite's switch for the one spec that exercises telemetry. */
  readonly testOptIn: boolean;
}

/** The collector URL, or null where nothing may be sent: localhost, non-production hosts, and
 *  the browser suite unless a spec opts in. The collector accepts only openisd.app. */
export function chooseEndpoint(c: EndpointChoice): string | null {
  if (c.mode === 'test') return c.testOptIn ? TELEMETRY_ENDPOINT : null;
  return c.hostname === TELEMETRY_HOSTNAME ? TELEMETRY_ENDPOINT : null;
}
