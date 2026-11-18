/** The pieces that join feedback to the rest of the app: the fetch transport, and the tap on user saves. */
import {describe, expect, it} from 'vitest';
import {FetchFeedbackTransport, OfflineFeedbackTransport} from '../../../src/logic/feedback/feedbackTransport.js';
import {SaveTappedTelemetry} from '../../../src/logic/feedback/saveTappedTelemetry.js';
import {NoTelemetry, type Telemetry} from '../../../src/logic/telemetry/telemetry.js';
import type {TelemetryEvent} from '../../../src/logic/telemetry/events.js';

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

describe('SaveTappedTelemetry', () => {
  it('passes every event on and tells listeners only about a project save', () => {
    const seen: TelemetryEvent[] = [];
    let flushed = 0;
    const inner: Telemetry = {record: e => { seen.push(e); }, flush: () => { flushed += 1; }};
    const tapped = new SaveTappedTelemetry(inner);
    let saves = 0;
    const stop = tapped.onUserSave(() => { saves += 1; });
    tapped.record({kind: 'install'});
    tapped.record({kind: 'project_save', format: 'stored', box: 'vented'});
    tapped.flush();
    expect(seen).toHaveLength(2);
    expect(flushed).toBe(1);
    expect(saves).toBe(1);
    stop();
    tapped.record({kind: 'project_save', format: 'owpr', box: 'sealed'});
    expect(saves).toBe(1);
    expect(new SaveTappedTelemetry(new NoTelemetry()).onUserSave(() => undefined)).toBeTypeOf('function');
  });
});
