import { describe, it, expect } from 'vitest';
import { createGoogleRevoker } from '../../../src/cloud/auth/googleRevoker.js';
import type { Http, HttpRequest, HttpResponse } from '../../../src/cloud/http.js';

describe('createGoogleRevoker', () => {
  it('sends POST to revoke URL with encoded token', async () => {
    let sentReq: HttpRequest | undefined;
    const http: Http = {
      async send(req: HttpRequest): Promise<HttpResponse> {
        sentReq = req;
        return { status: 200, text: '{}' };
      },
    };

    const revoker = createGoogleRevoker(http);
    await revoker.revoke('test-token/123');

    expect(sentReq).toEqual({
      method: 'POST',
      url: 'https://oauth2.googleapis.com/revoke?token=test-token%2F123',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  });

  it('ignores offline results (best effort)', async () => {
    const http: Http = {
      async send(): Promise<{ readonly kind: 'offline' }> {
        return { kind: 'offline' };
      },
    };

    const revoker = createGoogleRevoker(http);
    await expect(revoker.revoke('offline-token')).resolves.toBeUndefined();
  });

  it('ignores thrown errors (best effort)', async () => {
    const http: Http = {
      async send(): Promise<never> {
        throw new Error('network down');
      },
    };

    const revoker = createGoogleRevoker(http);
    await expect(revoker.revoke('error-token')).resolves.toBeUndefined();
  });
});
