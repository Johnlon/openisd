import {describe, expect, it} from 'vitest';
import {fieldsOf, type Fields, type PerfStep, type Skin, type TelemetryEvent} from '../../src/logic/telemetry/events.js';
import {afterPaintOf, deviceFactsOf, MAX_PERF_MS, PerfReporter, type DeviceFacts} from '../../src/logic/telemetry/perf.js';
import {SessionEnd} from '../../src/logic/telemetry/sessionEnd.js';
import {FeatureUse} from '../../src/logic/telemetry/featureUse.js';
import type {Telemetry} from '../../src/logic/telemetry/telemetry.js';

const KEYS = ['cores', 'count', 'max_ms', 'memory_gb', 'ms', 'skin', 'step'];
const MEMORY = [0.25, 0.5, 1, 2, 4, 8, 16, 32];

/** The collector's rules for a perf event: all seven keys, integers in range, nulls only where allowed. */
function violations(f: Fields): string[] {
  const bad: string[] = [];
  if (JSON.stringify(Object.keys(f).sort()) !== JSON.stringify(KEYS)) bad.push('keys');
  const isMs = (v: unknown): boolean => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_PERF_MS;
  if (!isMs(f.ms)) bad.push('ms');
  if (f.skin !== 'original' && f.skin !== 'mobile') bad.push('skin');
  if (f.step === 'recalc') {
    if (!isMs(f.max_ms)) bad.push('max_ms');
    if (typeof f.count !== 'number' || !Number.isInteger(f.count) || f.count < 1) bad.push('count');
  } else if (f.max_ms !== null || f.count !== null) bad.push('nulls');
  if (f.cores !== null && (typeof f.cores !== 'number' || !Number.isInteger(f.cores))) bad.push('cores');
  if (f.memory_gb !== null && (typeof f.memory_gb !== 'number' || !MEMORY.includes(f.memory_gb))) bad.push('memory_gb');
  return bad;
}

interface Rig {
  readonly perf: PerfReporter;
  readonly events: TelemetryEvent[];
  clock: number;
  paint(): void;
}

function rig(device: DeviceFacts, skin: Skin): Rig {
  const events: TelemetryEvent[] = [];
  const telemetry: Telemetry = {record: e => { events.push(e); }, flush: () => undefined};
  const waiting: (() => void)[] = [];
  const r: Rig = {
    events, clock: 0,
    perf: new PerfReporter({telemetry, now: () => r.clock, afterPaint: done => { waiting.push(done); }, skin: () => skin, device}),
    paint: () => { for (const done of waiting.splice(0)) done(); },
  };
  return r;
}

const perfFields = (r: Rig): Fields[] => r.events.map(fieldsOf);

describe('perf events', () => {
  it('boot_download is the script start time, once', () => {
    const r = rig({cores: 8, memoryGb: 4}, 'original');
    r.perf.bootDownload(412.6);
    r.perf.bootDownload(900);
    expect(perfFields(r)).toEqual([{step: 'boot_download', ms: 413, max_ms: null, count: null, skin: 'original', cores: 8, memory_gb: 4}]);
  });

  it('boot_catalogue times the first load only, and only once it succeeds', async () => {
    const r = rig({cores: null, memoryGb: null}, 'mobile');
    let fail = true;
    const load = r.perf.timedCatalogue(async () => { r.clock += 250; if (fail) throw new Error('offline'); return 'rows'; });
    await expect(load()).rejects.toThrow('offline');
    expect(r.events).toEqual([]);
    fail = false;
    expect(await load()).toBe('rows');
    await load();
    expect(perfFields(r)).toEqual([{step: 'boot_catalogue', ms: 250, max_ms: null, count: null, skin: 'mobile', cores: null, memory_gb: null}]);
  });

  it('boot_restore times the work and passes its result through; a throw reports nothing', async () => {
    const r = rig({cores: 2, memoryGb: 0.5}, 'original');
    expect(await r.perf.restoring(async () => { r.clock += 80; return 7; })).toBe(7);
    await expect(r.perf.restoring(async () => { throw new Error('x'); })).rejects.toThrow('x');
    expect(perfFields(r).map(f => [f.step, f.ms])).toEqual([['boot_restore', 80]]);
  });

  it('boot_ready and first_chart are measured from navigation start, after paint, once', () => {
    const r = rig({cores: 4, memoryGb: 8}, 'original');
    r.clock = 1000;
    r.perf.bootReady();
    r.perf.chartDrawn();
    expect(r.events).toEqual([]);
    r.clock = 1300;
    r.paint();
    r.perf.bootReady();
    r.perf.chartDrawn();
    r.clock = 5000;
    r.paint();
    expect(perfFields(r).map(f => [f.step, f.ms])).toEqual([['boot_ready', 1300], ['first_chart', 1300]]);
  });

  it('project_open reports the first open only, when its screen is drawn', () => {
    const r = rig({cores: 4, memoryGb: 8}, 'original');
    r.clock = 100;
    r.perf.projectOpened();
    r.clock = 160;
    r.paint();
    r.paint();
    r.perf.projectOpened();
    r.clock = 900;
    r.paint();
    expect(perfFields(r).map(f => [f.step, f.ms])).toEqual([['project_open', 60]]);
  });

  it('driver_list_open waits for rows; an open that got none is not reported and the next one may be', async () => {
    const r = rig({cores: 4, memoryGb: 8}, 'mobile');
    r.perf.driverListOpened(Promise.resolve(false));
    await Promise.resolve();
    r.paint();
    expect(r.events).toEqual([]);
    r.clock = 10;
    r.perf.driverListOpened(Promise.resolve(true));
    r.clock = 45;
    await Promise.resolve();
    r.paint();
    r.perf.driverListOpened(Promise.resolve(true));
    await Promise.resolve();
    r.paint();
    expect(perfFields(r).map(f => [f.step, f.ms])).toEqual([['driver_list_open', 35]]);
  });

  it('recalc is one summary at session end: median, max and count', () => {
    const r = rig({cores: 4, memoryGb: 8}, 'original');
    for (const ms of [30, 10, 200, 20]) {
      r.perf.edited();
      r.perf.edited();
      r.clock += ms;
      r.paint();
    }
    expect(r.events).toEqual([]);
    r.perf.sessionEnded();
    r.perf.sessionEnded();
    expect(perfFields(r)).toEqual([{step: 'recalc', ms: 25, max_ms: 200, count: 4, skin: 'original', cores: 4, memory_gb: 8}]);
  });

  it('a session with no edit sends no recalc', () => {
    const r = rig({cores: 4, memoryGb: 8}, 'original');
    r.perf.sessionEnded();
    expect(r.events).toEqual([]);
  });

  it('every event passes the collector rules, including out-of-range and odd device values', () => {
    const r = rig(deviceFactsOf({hardwareConcurrency: 12.5, deviceMemory: 3}), 'mobile');
    r.perf.bootDownload(-5);
    r.perf.bootReady();
    r.clock = 9_999_999;
    r.paint();
    r.perf.edited();
    r.paint();
    r.perf.sessionEnded();
    const steps: PerfStep[] = r.events.flatMap(e => e.kind === 'perf' ? [e.step] : []);
    expect(steps).toEqual(['boot_download', 'boot_ready', 'recalc']);
    for (const f of perfFields(r)) expect(violations(f)).toEqual([]);
    expect(JSON.parse(JSON.stringify(perfFields(r)[0]))).toHaveProperty('max_ms', null);
  });

  it('device facts keep only what the collector accepts', () => {
    expect(deviceFactsOf({hardwareConcurrency: 8, deviceMemory: 8})).toEqual({cores: 8, memoryGb: 8});
    expect(deviceFactsOf({hardwareConcurrency: 8, deviceMemory: 6})).toEqual({cores: 8, memoryGb: null});
    expect(deviceFactsOf({})).toEqual({cores: null, memoryGb: null});
  });

  it('the session end event sends the recalc summary and nothing else changes', () => {
    const r = rig({cores: 4, memoryGb: 8}, 'original');
    const sent: TelemetryEvent[] = [];
    const telemetry: Telemetry = {record: e => { sent.push(e); }, flush: () => undefined};
    r.perf.edited();
    r.clock = 5;
    r.paint();
    new SessionEnd(telemetry, new FeatureUse(telemetry), () => 3000, 0, r.perf).end();
    expect(sent).toEqual([{kind: 'session_end', seconds: 3, charts: 0}]);
    expect(r.events.map(e => e.kind)).toEqual(['perf']);
  });

  it('afterPaint runs the work in a task after the frame', () => {
    const order: string[] = [];
    const frames: (() => void)[] = [];
    const tasks: (() => void)[] = [];
    afterPaintOf(c => frames.push(c), c => tasks.push(c))(() => order.push('done'));
    expect(order).toEqual([]);
    frames[0]();
    expect(order).toEqual([]);
    tasks[0]();
    expect(order).toEqual(['done']);
  });
});
