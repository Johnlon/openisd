import type {FeedbackTransport} from './feedbackOutbox.js';

/** Posts to the telemetry collector with `fetch`, typed text/plain like the usage beacon so the request needs no
 *  CORS preflight. True only when the collector answers ok; a down network is false, never an error. */
export class FetchFeedbackTransport implements FeedbackTransport {
  /** Whether the browser says the network is up. */
  readonly online: () => boolean;

  constructor(
    private readonly endpoint: string,
    private readonly fetchFn: typeof fetch,
    isOnline: () => boolean,
  ) {
    this.online = isOnline;
  }

  async post(body: string): Promise<boolean> {
    try {
      const response = await this.fetchFn(this.endpoint, {method: 'POST', headers: {'content-type': 'text/plain'}, body, credentials: 'omit', keepalive: true});
      return response.ok;
    } catch {
      return false;
    }
  }
}

/** Where no collector may be used (a dev server, the browser suite): answers are kept and never sent. */
export class OfflineFeedbackTransport implements FeedbackTransport {
  online(): boolean {
    return false;
  }

  async post(_body: string): Promise<boolean> {
    return false;
  }
}
