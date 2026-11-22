export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT';

export interface HttpRequest {
  readonly method: HttpMethod;
  readonly url: string;
  readonly headers?: Record<string, string>;
  readonly body?: string;
}

export interface HttpResponse {
  readonly status: number;
  readonly text: string;
  readonly headers?: Record<string, string>;
}

/** A reply; or no reply because the browser is offline; or no reply although it is online. */
export type HttpResult =
  | HttpResponse
  | { readonly kind: 'offline' }
  | { readonly kind: 'unreachable'; readonly reason: string };

export interface Http {
  send(request: HttpRequest): Promise<HttpResult>;
}

/** The one Http over the browser's fetch; the composition root passes `globalThis.fetch` and
 *  `navigator.onLine`. A fetch that throws is "offline" only when the browser says it is. */
export function createFetchHttp(fetchFn: typeof fetch, online: () => boolean): Http {
  return {
    async send(req: HttpRequest): Promise<HttpResult> {
      try {
        const res = await fetchFn(req.url, {
          method: req.method,
          headers: req.headers,
          body: req.body
        });
        const text = await res.text();
        const headers: Record<string, string> = {};
        res.headers.forEach((val, key) => {
          headers[key.toLowerCase()] = val;
        });
        return {
          status: res.status,
          text,
          headers
        };
      } catch (err) {
        if (!online()) return { kind: 'offline' };
        return { kind: 'unreachable', reason: err instanceof Error ? err.message : String(err) };
      }
    }
  };
}
