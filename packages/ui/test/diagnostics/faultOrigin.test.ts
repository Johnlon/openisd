import {afterEach, describe, expect, it, vi} from 'vitest';
import {createAppSettingsRepo, createStoredDataFault, isStoredDataFault, createMemoryStorage, createViewStateRepo} from '@openisd/persistence';
import {createFaultLog, originLabel, type FaultLog} from '../../src/diagnostics/faultLog.js';

// BUG: the fault log could not say where a fault came from, so a stored-data problem, a code
// bug and a half-reloaded dev page all looked alike and all offered the same repairs.

type Listener = (e: unknown) => void;
const storeOf = (thrown: unknown) => isStoredDataFault(thrown) ? thrown.store : null;

function installedLog(): {log: FaultLog; fire: (type: string, e: unknown) => void; raised: number[]} {
  const listeners = new Map<string, Listener>();
  vi.stubGlobal('window', {addEventListener: (type: string, fn: Listener) => { listeners.set(type, fn); }});
  const storage = createMemoryStorage();
  const log = createFaultLog(() => undefined, () => ({
    view: createViewStateRepo(storage), appSettings: createAppSettingsRepo(storage),
  }), storeOf);
  const raised: number[] = [];
  log.onFault(f => raised.push(f.id));
  log.install();
  return {log, fire: (type, e) => listeners.get(type)?.(e), raised};
}

const realConsoleError = console.error;
afterEach(() => { console.error = realConsoleError; vi.unstubAllGlobals(); });

describe('fault origin', () => {
  it('an uncaught error from running code has origin "code"', () => {
    const {log, fire} = installedLog();
    fire('error', {message: 'boom', error: new Error('boom')});
    expect(log.faults[0].origin).toEqual({kind: 'code'});
  });

  it('a StoredDataFault names the store it came from', () => {
    const {log, fire} = installedLog();
    fire('error', {message: 'bad view', error: createStoredDataFault('view', 'bad view')});
    expect(log.faults[0].origin).toEqual({kind: 'stored-data', store: 'view'});
  });

  it('a StoredDataFault logged through console.error names its store too', () => {
    const {log} = installedLog();
    console.error(createStoredDataFault('options', 'options record unreadable'));
    expect(log.faults[0].origin).toEqual({kind: 'stored-data', store: 'options'});
  });

  it('a fault whose stack carries a hot-reload stamp is a dev reload, and raises no dialog', () => {
    const {log, fire, raised} = installedLog();
    const stale = new Error('x');
    stale.stack = 'Error: x\n    at f (http://localhost:4000/src/appState.ts?t=1791043377126:10:5)';
    fire('error', {message: 'x', error: stale});
    expect(log.faults[0].origin).toEqual({kind: 'dev-reload'});
    expect(raised).toEqual([]);
  });

  it('a code fault raises the dialog', () => {
    const {fire, raised} = installedLog();
    fire('error', {message: 'boom', error: new Error('boom')});
    expect(raised).toEqual([1]);
  });
});

describe('repairs follow the origin', () => {
  it('a code fault offers no repair, however much is stored', () => {
    const {log, fire} = installedLog();
    fire('error', {message: 'boom', error: new Error('boom')});
    expect(log.applicable()).toEqual([]);
  });

  it('a stored-data fault offers only the repair for its own store', () => {
    const storage = createMemoryStorage();
    const view = createViewStateRepo(storage);
    const appSettings = createAppSettingsRepo(storage);
    storage.set('openisd_view', '{"ui":{}}');
    appSettings.setEnvDefaults({tempK: 300, humidityPct: 40, pressurePa: 100000});
    vi.stubGlobal('window', {addEventListener: (type: string, fn: Listener) => { if (type === 'error') fire = fn; }});
    let fire: Listener = () => undefined;
    const log = createFaultLog(() => undefined, () => ({view, appSettings}), storeOf);
    log.install();
    fire({message: 'bad view', error: createStoredDataFault('view', 'bad view')});
    expect(log.applicable().map(f => f.id)).toEqual(['reset-view']);
  });
});

describe('report and labels', () => {
  it('the report states each fault origin', () => {
    const {log, fire} = installedLog();
    vi.stubGlobal('location', {href: 'http://x'});
    vi.stubGlobal('navigator', {userAgent: 't'});
    vi.stubGlobal('localStorage', {});
    fire('error', {message: 'bad view', error: createStoredDataFault('view', 'bad view')});
    expect(log.report()).toContain('origin: stored data (view)');
  });

  it('a fault carries its own origin label for a screen that cannot import the log', () => {
    const {log, fire} = installedLog();
    fire('error', {message: 'bad view', error: createStoredDataFault('view', 'bad view')});
    expect(log.faults[0].originLabel).toBe('stored data (view)');
  });

  it('every origin has a plain label', () => {
    expect(originLabel({kind: 'code'})).toBe('running code');
    expect(originLabel({kind: 'dev-reload'})).toBe('dev reload');
    expect(originLabel({kind: 'stored-data', store: 'driver'})).toBe('stored data (driver)');
  });
});
