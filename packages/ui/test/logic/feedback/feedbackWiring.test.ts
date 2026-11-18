/** The pieces that join feedback to the rest of the app: the fetch transport. */
import {describe, expect, it} from 'vitest';
import {FetchFeedbackTransport, OfflineFeedbackTransport} from '../../../src/logic/feedback/feedbackTransport.js';

describe('FetchFeedbackTransport', () => {
  it('posts the body as text/plain (no preflight) and is true only for an ok answer', async () => {
    const calls: {url: string; init: RequestInit}[] = [];
    let status = 204;
    const t = new FetchFeedbackTransport('https://stats.test/e', async (url, init) => { calls.push({url: String(url), init: init ?? {}}); return new Response(null, {status}); }, () => true);
    expect(await t.post('[1]')).toBe(true);
    expect(calls[0]?.url).toBe('https://stats.test/e');
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.body).toBe('[1]');
    expect(new Headers(calls[0]?.init.headers).get('content-type')).toBe('text/plain');
    status = 400;
    expect(await t.post('[1]')).toBe(false);
  });
  it('is false, not an error, when the network is down', async () => {
    const t = new FetchFeedbackTransport('https://stats.test/e', async () => { throw new TypeError('Failed to fetch'); }, () => true);
    expect(await t.post('[]')).toBe(false);
  });
  it('follows the browser online flag', () => {
    expect(new FetchFeedbackTransport('u', async () => new Response(null), () => false).online()).toBe(false);
  });
  it('the offline transport (no collector on this host) never sends', async () => {
    const t = new OfflineFeedbackTransport();
    expect(t.online()).toBe(false);
    expect(await t.post('[]')).toBe(false);
  });
});
