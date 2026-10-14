import { describe, expect, it } from 'vitest';
import { createFetchHttp } from '../../src/cloud/http.js';

const thrower: typeof fetch = () => Promise.reject(new TypeError('Failed to fetch'));

describe('createFetchHttp', () => {
  it('a request that throws while the browser is online is unreachable, with the reason', async () => {
    const http = createFetchHttp(thrower, () => true);
    expect(await http.send({ method: 'GET', url: 'https://x/' })).toEqual({ kind: 'unreachable', reason: 'Failed to fetch' });
  });

  it('a request that throws while the browser is offline is offline', async () => {
    const http = createFetchHttp(thrower, () => false);
    expect(await http.send({ method: 'GET', url: 'https://x/' })).toEqual({ kind: 'offline' });
  });
});
