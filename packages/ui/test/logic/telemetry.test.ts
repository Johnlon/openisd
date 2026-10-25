import {describe, expect, it, vi} from 'vitest';
import {BeaconTelemetry, NoTelemetry} from '../../src/logic/telemetry/telemetry.js';
import {errorEventOf, fieldsOf, type AnonymousErrorContext, type TelemetryEvent} from '../../src/logic/telemetry/events.js';
import {screenWidthBandOf, SKINS} from '../../src/logic/telemetry/events.js';
import {InstallMarker, INSTALL_SENT_KEY} from '../../src/logic/telemetry/install.js';
import {browserIdOf, BROWSER_ID_KEY} from '../../src/logic/telemetry/browserId.js';
import {SessionEnd} from '../../src/logic/telemetry/sessionEnd.js';
import {FeatureUse} from '../../src/logic/telemetry/featureUse.js';
import {registerServiceWorker} from '../../src/logic/telemetry/serviceWorker.js';
import {createMemoryStorage} from '@openisd/persistence';
import {crashHash} from '../../src/logic/telemetry/crashHash.js';
import {LaunchReporter, platformOf, referrerHost, type LaunchEnvironment} from '../../src/logic/telemetry/launch.js';
import {chooseEndpoint, TELEMETRY_ENDPOINT} from '../../src/logic/telemetry/endpoint.js';
import {CrashReports} from '../../src/logic/telemetry/crashReports.js';
import {ErrorContext, RecentActions} from '../../src/logic/telemetry/errorContext.js';

/** A context with nothing known but the box type. */
function emptyErrorContext(box = 'none'): AnonymousErrorContext {
  return {screen: 'none', dialog: 'none', projects: 0, box, actions: '', device: 'other'};
}

const ENV: LaunchEnvironment = {
  standalone: true, platformHint: undefined, userAgent: 'Mozilla/5.0 (Linux; Android 14)',
  screenW: 390, screenH: 844, lang: 'en-GB', referrer: 'https://example.org/page?x=1', keysLost: [],
};

function rig(options: {online?: boolean; accepted?: boolean} = {}) {
  const sent: {url: string; body: Blob}[] = [];
  const beacon = vi.fn((url: string, body: Blob) => { sent.push({url, body}); return options.accepted ?? true; });
  const telemetry = new BeaconTelemetry({
    endpoint: TELEMETRY_ENDPOINT, version: 'v1', beacon, online: () => options.online ?? true, now: () => 1000, sessionId: 'sess', browserId: 'browser-1',
  });
  const bodies = async (): Promise<unknown[][]> => Promise.all(sent.map(async s => {
    const parsed: unknown = JSON.parse(await s.body.text());
    const events: unknown[] = Array.isArray(parsed) ? parsed : [];
    return events;
  }));
  return {telemetry, beacon, sent, bodies};
}

function noInstall(): InstallMarker {
  return new InstallMarker(new NoTelemetry(), createMemoryStorage());
}

const PICK: TelemetryEvent = {kind: 'driver_pick', source: 'bundled', id: 'abc', name: 'Morel MW 1258'};

describe('BeaconTelemetry', () => {
  it('sends launch with the right fields on install', async () => {
    const r = rig();
    new LaunchReporter(r.telemetry, () => ENV, work => work(), noInstall()).report('mobile');
    expect(r.beacon).toHaveBeenCalledTimes(1);
    expect(r.sent[0]?.url).toBe(TELEMETRY_ENDPOINT);
    expect(r.sent[0]?.body.type).toBe('text/plain');
    expect(await r.bodies()).toEqual([[{
      name: 'launch', ts: 1000, version: 'v1', session: 'sess', browser_id: 'browser-1',
      fields: {mode: 'standalone', platform: 'Android', skin: 'mobile', w: 390, h: 844, screen: '<600', lang: 'en-GB', ref: 'example.org'},
    }]]);
  });

  it('names the storage keys lost since the last start, and only when some were', async () => {
    const r = rig();
    new LaunchReporter(r.telemetry, () => ({...ENV, keysLost: ['openisd_my_drivers', 'openisd_view']}), work => work(), noInstall()).report('mobile');
    expect(await r.bodies()).toEqual([[{
      name: 'launch', ts: 1000, version: 'v1', session: 'sess', browser_id: 'browser-1',
      fields: {
        mode: 'standalone', platform: 'Android', skin: 'mobile', w: 390, h: 844, screen: '<600', lang: 'en-GB', ref: 'example.org',
        keysLost: 'openisd_my_drivers,openisd_view',
      },
    }]]);
  });

  it('reports a launch only once', () => {
    const r = rig();
    const launch = new LaunchReporter(r.telemetry, () => ENV, work => work(), noInstall());
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

describe('fieldsOf usage events', () => {
  it('chart_view carries the chart', () => {
    expect(fieldsOf({kind: 'chart_view', chart: 'SPL'})).toEqual({chart: 'SPL'});
  });
  it('feature carries the name', () => {
    expect(fieldsOf({kind: 'feature', name: 'whatif'})).toEqual({name: 'whatif'});
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
    const ev = errorEventOf(e, emptyErrorContext('sealed'));
    expect(ev.message).toHaveLength(200);
    expect(ev.frames).toBe('at a (f.js:1:1)\nat b (f.js:2:2)\nat c (f.js:3:3)');
    expect(ev.box).toBe('sealed');
  });

  it('caps frames at 600 characters and handles non-errors', () => {
    const e = new Error('m');
    e.stack = `Error: m\n    at ${'a'.repeat(400)}\n    at ${'b'.repeat(400)}`;
    expect(errorEventOf(e, emptyErrorContext('')).frames.length).toBe(600);
    expect(errorEventOf('plain', emptyErrorContext(''))).toEqual({
      kind: 'error',
      message: 'plain',
      frames: '',
      box: '',
      screen: 'none',
      dialog: 'none',
      projects: 0,
      actions: '',
      device: 'other',
    });
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
    const actions = new RecentActions();
    actions.record('tab:box');
    const errorContext = new ErrorContext({
      screen: () => 'original/enclosure',
      dialog: () => 'none',
      projects: () => 1,
      box: () => 'vented',
      actions,
      device: () => 'android',
    });
    const crashes = new CrashReports(r.telemetry, errorContext, async (m, f) => `hash:${m}:${f}`);
    crashes.capture(new Error('boom'));
    expect(r.beacon).toHaveBeenCalledTimes(1);
    expect(crashes.pending.value?.message).toBe('boom');
    const frames = crashes.pending.value?.frames ?? '';
    crashes.submit('n'.repeat(2000), 'me@example.org');
    await vi.waitFor(() => expect(r.beacon).toHaveBeenCalledTimes(2));
    expect((await r.bodies())[0]?.[0]).toMatchObject({
      name: 'error',
      fields: {
        message: 'boom',
        box: 'vented',
        screen: 'original/enclosure',
        dialog: 'none',
        projects: 1,
        actions: 'tab:box',
        device: 'android',
      },
    });
    expect((await r.bodies())[1]?.[0]).toMatchObject({
      name: 'report',
      fields: {
        message: 'boom',
        note: 'n'.repeat(1000),
        contact: 'me@example.org',
        hash: `hash:boom:${frames}`,
        box: 'vented',
        screen: 'original/enclosure',
        dialog: 'none',
        projects: 1,
        actions: 'tab:box',
        device: 'android',
      },
    });
    expect(crashes.pending.value).toBeNull();
  });
});

describe('CrashReports.logOnly', () => {
  it('sends the error with its context but offers no report box', async () => {
    const r = rig();
    const actions = new RecentActions();
    actions.record('close-project');
    const errorContext = new ErrorContext({
      screen: () => 'mobile/graph',
      dialog: () => 'none',
      projects: () => 0,
      box: () => 'none',
      actions,
      device: () => 'android',
    });
    const crashes = new CrashReports(r.telemetry, errorContext, async () => '');
    crashes.logOnly(new Error('no project is focused'));
    expect(r.beacon).toHaveBeenCalledTimes(1);
    expect(crashes.pending.value).toBeNull();
    expect((await r.bodies())[0]?.[0]).toMatchObject({
      name: 'error',
      fields: {
        message: 'no project is focused',
        box: 'none',
        screen: 'mobile/graph',
        projects: 0,
        actions: 'close-project',
        device: 'android',
      },
    });
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
    expect(chooseEndpoint({hostname: 'openisd.app', mode: 'production', testOptIn: false})).toBe(TELEMETRY_ENDPOINT);
    expect(chooseEndpoint({hostname: 'test.openisd.app', mode: 'production', testOptIn: false})).toBeNull();
    expect(chooseEndpoint({hostname: 'x.github.io', mode: 'production', testOptIn: false})).toBeNull();
  });
});

describe('launch details', () => {
  it('bands the screen width', () => {
    expect([599, 600, 1023, 1024, 1439, 1440, 1919, 1920].map(screenWidthBandOf))
      .toEqual(['<600', '<1024', '<1024', '<1440', '<1440', '<1920', '<1920', '>=1920']);
  });

  it('sends the referrer host name only, without port, path or query', () => {
    expect(referrerHost('https://example.org:8443/page?x=1')).toBe('example.org');
  });

  it('spells every skin in lower case', () => {
    expect(SKINS.every(skin => skin === skin.toLowerCase())).toBe(true);
  });
});

describe('browser id', () => {
  it('is minted once, kept under its own key, and sent with every event', async () => {
    const storage = createMemoryStorage();
    const first = browserIdOf(storage, () => 'minted');
    const again = browserIdOf(storage, () => 'other');
    expect([first, again]).toEqual(['minted', 'minted']);
    expect(storage.get(BROWSER_ID_KEY)).toBe('minted');
    const r = rig();
    r.telemetry.record({kind: 'feature', name: 'whatif'});
    r.telemetry.flush();
    expect(await r.bodies()).toEqual([[expect.objectContaining({browser_id: 'browser-1'})]]);
  });
});

describe('install', () => {
  it('is sent on appinstalled, and not again at a standalone launch', () => {
    const record = vi.fn();
    const marker = new InstallMarker({record, flush: vi.fn()}, createMemoryStorage());
    marker.noteInstalled();
    marker.noteLaunch(true);
    expect(record.mock.calls).toEqual([[{kind: 'install'}]]);
  });

  it('is sent once at the first standalone launch when appinstalled never fired', () => {
    const record = vi.fn();
    const storage = createMemoryStorage();
    const marker = new InstallMarker({record, flush: vi.fn()}, storage);
    marker.noteLaunch(false);
    expect(record).not.toHaveBeenCalled();
    marker.noteLaunch(true);
    marker.noteLaunch(true);
    expect(record.mock.calls).toEqual([[{kind: 'install'}]]);
    expect(storage.get(INSTALL_SENT_KEY)).not.toBeNull();
  });
});

describe('session end', () => {
  it('records the seconds open and the charts viewed, once', () => {
    const record = vi.fn();
    const telemetry = {record, flush: vi.fn()};
    const features = new FeatureUse(telemetry);
    features.chart('SPL');
    features.chart('SPL');
    features.chart('Zmag');
    record.mockClear();
    const end = new SessionEnd(telemetry, features, () => 12_600, 1000);
    end.end();
    end.end();
    expect(record.mock.calls).toEqual([[{kind: 'session_end', seconds: 12, charts: 2}]]);
  });
});

describe('service worker registration', () => {
  it('registers quietly when allowed', async () => {
    const record = vi.fn();
    const register = vi.fn(() => Promise.resolve(undefined));
    await registerServiceWorker({register}, '/sw.js', '/', {record, flush: vi.fn()}, 'Windows');
    expect(register).toHaveBeenCalledWith('/sw.js', {scope: '/', updateViaCache: 'none'});
    expect(record).not.toHaveBeenCalled();
  });

  it('catches a refusal and sends sw_blocked instead of a crash', async () => {
    const record = vi.fn();
    await registerServiceWorker({register: () => Promise.reject(new Error('Rejected'))}, '/sw.js', '/', {record, flush: vi.fn()}, 'Windows');
    expect(record.mock.calls).toEqual([[{kind: 'sw_blocked', platform: 'Windows'}]]);
  });
});

describe('crash dedupe', () => {
  it('sends one error per message in a session, and still offers the report box', () => {
    const record = vi.fn<(event: TelemetryEvent) => void>();
    const crashes = new CrashReports(
      {record, flush: vi.fn()},
      new ErrorContext({
        screen: () => 'original/enclosure',
        dialog: () => 'none',
        projects: () => 1,
        box: () => 'vented',
        actions: new RecentActions(),
        device: () => 'linux',
      }),
      () => Promise.resolve('h'),
    );
    crashes.capture(new Error('boom'));
    crashes.capture(new Error('boom'));
    crashes.capture(new Error('other'));
    expect(record.mock.calls.map(c => fieldsOf(c[0]).message)).toEqual(['boom', 'other']);
    expect(crashes.pending.value?.message).toBe('other');
  });
});
