import {describe, expect, it, vi} from 'vitest';
import {BeaconTelemetry, NoTelemetry} from '../../src/telemetry/telemetry.js';
import {errorEventOf, type TelemetryEvent} from '../../src/telemetry/events.js';
import {crashHash} from '../../src/telemetry/crashHash.js';
import {LaunchReporter, platformOf, referrerHost, type LaunchEnvironment} from '../../src/telemetry/launch.js';
import {chooseEndpoint, TELEMETRY_ENDPOINT} from '../../src/telemetry/endpoint.js';
import {CrashReports} from '../../src/telemetry/crashReports.js';

const ENV: LaunchEnvironment = {
  standalone: true, platformHint: undefined, userAgent: 'Mozilla/5.0 (Linux; Android 14)',
  screenW: 390, screenH: 844, lang: 'en-GB', referrer: 'https://example.org/page?x=1',
};

function rig(options: {online?: boolean; accepted?: boolean} = {}) {
  const sent: {url: string; body: Blob}[] = [];
  const beacon = vi.fn((url: string, body: Blob) => { sent.push({url, body}); return options.accepted ?? true; });
  const telemetry = new BeaconTelemetry({
    endpoint: TELEMETRY_ENDPOINT, version: 'v1', beacon, online: () => options.online ?? true, now: () => 1000, sessionId: 'sess',
  });
  const bodies = async (): Promise<unknown[][]> => Promise.all(sent.map(async s => {
    const parsed: unknown = JSON.parse(await s.body.text());
    const events: unknown[] = Array.isArray(parsed) ? parsed : [];
    return events;
  }));
  return {telemetry, beacon, sent, bodies};
}

const PICK: TelemetryEvent = {kind: 'driver_pick', source: 'bundled', id: 'abc'};

describe('BeaconTelemetry', () => {
  it('sends launch with the right fields on install', async () => {
    const r = rig();
    new LaunchReporter(r.telemetry, () => ENV, work => work()).report('mobile');
    expect(r.beacon).toHaveBeenCalledTimes(1);
    expect(r.sent[0]?.url).toBe(TELEMETRY_ENDPOINT);
    expect(r.sent[0]?.body.type).toBe('application/json');
    expect(await r.bodies()).toEqual([[{
      name: 'launch', ts: 1000, version: 'v1', session: 'sess',
      fields: {mode: 'standalone', platform: 'Android', skin: 'mobile', w: 390, h: 844, lang: 'en-GB', ref: 'example.org'},
    }]]);
  });

  it('reports a launch only once', () => {
    const r = rig();
    const launch = new LaunchReporter(r.telemetry, () => ENV, work => work());
    launch.report('original');
    launch.report('original');
    expect(r.beacon).toHaveBeenCalledTimes(1);
  });

  it('batches at most 50 events per beacon', async () => {
    const r = rig();
    for (let i = 0; i < 120; i++) r.telemetry.record(PICK);
    r.telemetry.flush();
    expect((await r.bodies()).map(b => b.length)).toEqual([50, 50, 20]);
  });

  it('clears the queue when the beacon refuses and stores nothing', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', {setItem, getItem: vi.fn(), removeItem: vi.fn()});
    const r = rig({accepted: false});
    r.telemetry.record(PICK);
    r.telemetry.flush();
    r.telemetry.flush();
    expect(r.beacon).toHaveBeenCalledTimes(1);
    expect(setItem).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('drops events without a beacon call when offline', () => {
    const r = rig({online: false});
    r.telemetry.record(PICK);
    r.telemetry.flush();
    expect(r.beacon).not.toHaveBeenCalled();
  });
});

describe('NoTelemetry', () => {
  it('never calls a beacon', () => {
    const beacon = vi.fn();
    const t = new NoTelemetry();
    t.record();
    t.flush();
    expect(beacon).not.toHaveBeenCalled();
  });
});

describe('error events', () => {
  it('truncates the message to 200 and keeps the top 3 frames', () => {
    const e = new Error('x'.repeat(500));
    e.stack = `Error: boom\n    at a (f.js:1:1)\n    at b (f.js:2:2)\n    at c (f.js:3:3)\n    at d (f.js:4:4)`;
    const ev = errorEventOf(e, 'sealed');
    expect(ev.message).toHaveLength(200);
    expect(ev.frames).toBe('at a (f.js:1:1)\nat b (f.js:2:2)\nat c (f.js:3:3)');
    expect(ev.box).toBe('sealed');
  });

  it('caps frames at 600 characters and handles non-errors', () => {
    const e = new Error('m');
    e.stack = `Error: m\n    at ${'a'.repeat(400)}\n    at ${'b'.repeat(400)}`;
    expect(errorEventOf(e, '').frames.length).toBe(600);
    expect(errorEventOf('plain', '')).toEqual({kind: 'error', message: 'plain', frames: '', box: ''});
  });
});

describe('crashHash', () => {
  it('is the first 24 hex chars of SHA-256 over version, message, frames', async () => {
    // printf 'v1\nboom\nat a' | sha256sum | cut -c1-24
    expect(await crashHash('v1', 'boom', 'at a')).toBe('23d8072d44260b0426d1267a');
  });
});

describe('CrashReports', () => {
  it('records the error, flushes, then sends a report with the user text', async () => {
    const r = rig();
    const crashes = new CrashReports(r.telemetry, () => 'vented', async (m, f) => `hash:${m}:${f}`);
    crashes.capture(new Error('boom'));
    expect(r.beacon).toHaveBeenCalledTimes(1);
    expect(crashes.pending.value?.message).toBe('boom');
    const frames = crashes.pending.value?.frames ?? '';
    crashes.submit('n'.repeat(2000), 'me@example.org');
    await vi.waitFor(() => expect(r.beacon).toHaveBeenCalledTimes(2));
    expect((await r.bodies())[1]?.[0]).toMatchObject({
      name: 'report',
      fields: {note: 'n'.repeat(1000), contact: 'me@example.org', hash: `hash:boom:${frames}`},
    });
    expect(crashes.pending.value).toBeNull();
  });
});

describe('launch helpers and endpoint', () => {
  it('reads platform and referrer host', () => {
    expect(platformOf('Windows', '')).toBe('Windows');
    expect(platformOf(undefined, 'iPhone; CPU iPhone OS')).toBe('iOS');
    expect(platformOf(undefined, 'Macintosh')).toBe('macOS');
    expect(platformOf(undefined, 'weird')).toBe('other');
    expect(referrerHost('')).toBe('');
    expect(referrerHost('not a url')).toBe('');
  });

  it('chooses no endpoint on localhost or in the suite unless opted in', () => {
    expect(chooseEndpoint({hostname: 'localhost', mode: 'development', testOptIn: false})).toBeNull();
    expect(chooseEndpoint({hostname: '127.0.0.1', mode: 'production', testOptIn: false})).toBeNull();
    expect(chooseEndpoint({hostname: 'localhost', mode: 'test', testOptIn: false})).toBeNull();
    expect(chooseEndpoint({hostname: 'localhost', mode: 'test', testOptIn: true})).toBe(TELEMETRY_ENDPOINT);
    expect(chooseEndpoint({hostname: 'x.github.io', mode: 'production', testOptIn: false})).toBe(TELEMETRY_ENDPOINT);
  });
});
