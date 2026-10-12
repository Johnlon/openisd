/** Where usage events go. */
export const TELEMETRY_ENDPOINT = 'https://openisd-stats.john-lonergan-0e9.workers.dev/e';

export interface EndpointChoice {
  readonly hostname: string;
  /** Vite mode; the browser suite builds with `test`. */
  readonly mode: string;
  /** The browser suite's switch for the one spec that exercises telemetry. */
  readonly testOptIn: boolean;
}

/** The collector URL, or null where nothing may be sent: localhost, and the browser suite
 *  unless a spec opts in. */
export function chooseEndpoint(c: EndpointChoice): string | null {
  if (c.mode === 'test') return c.testOptIn ? TELEMETRY_ENDPOINT : null;
  if (c.hostname === 'localhost' || c.hostname === '127.0.0.1') return null;
  return TELEMETRY_ENDPOINT;
}
