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

export interface Http {
  send(request: HttpRequest): Promise<HttpResponse | { readonly kind: 'offline' }>;
}

/** The one Http over the browser's fetch; the composition root passes `globalThis.fetch`. */
export function createFetchHttp(fetchFn: typeof fetch): Http {
  return {
    async send(req: HttpRequest): Promise<HttpResponse | { readonly kind: 'offline' }> {
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
      } catch {
        return { kind: 'offline' };
      }
    }
  };
}
