import {describe, expect, it, vi} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '@openisd/design';
import {createBundledDriverRepo} from '@openisd/persistence';
import {driverPickRecorder} from '../../src/logic/telemetry/driverPick.js';
import {fieldsOf, type TelemetryEvent} from '../../src/logic/telemetry/events.js';
import type {Telemetry} from '../../src/logic/telemetry/telemetry.js';

const engine = createEngine();
const driver = ProjectBuilder.empty(engine).driver.detach();

function indexJson(uuid: string): string {
  return JSON.stringify([{
    uuid, path: 'morel/mw-1258', name: 'Morel MW 1258', dq: false, datasheet: null, productPage: null, listingPage: null,
    chips: ['woofer'], canonical: 'Woofer', Fs_hz: 28, Sd_m2: 0.0471, Xmax_m: 0.01, Vd_m3: 0.000471, Znom_ohm: 8,
  }]);
}

function recorderOver(fetchIndex: () => Promise<Response>) {
  const record = vi.fn<(e: TelemetryEvent) => void>();
  const telemetry: Telemetry = {record, flush: vi.fn()};
  const catalogue = createBundledDriverRepo({fetch: fetchIndex, baseUrl: '/', engine, maxAge_ms: 1, now: Date.now});
  return {record, pick: driverPickRecorder(telemetry, catalogue)};
}

describe('driverPickRecorder', () => {
  it('a catalogue driver is recorded with its id and its catalogue name', async () => {
    const {record, pick} = recorderOver(async () => new Response(indexJson(driver.uuid())));
    pick(driver);
    await vi.waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    expect(record).toHaveBeenCalledWith({kind: 'driver_pick', source: 'bundled', id: driver.uuid(), name: 'Morel MW 1258'});
  });

  it('a driver the catalogue does not list is recorded with no id and no name', async () => {
    const {record, pick} = recorderOver(async () => new Response(indexJson('00000000-0000-4000-8000-000000000000')));
    pick(driver);
    await vi.waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    expect(record).toHaveBeenCalledWith({kind: 'driver_pick', source: 'mine', id: '', name: ''});
  });

  it('a catalogue that cannot be read records the pick as mine', async () => {
    const {record, pick} = recorderOver(async () => { throw new Error('offline'); });
    pick(driver);
    await vi.waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    expect(record).toHaveBeenCalledWith({kind: 'driver_pick', source: 'mine', id: '', name: ''});
  });
});

describe('fieldsOf driver_pick', () => {
  it('carries the name when there is one', () => {
    expect(fieldsOf({kind: 'driver_pick', source: 'bundled', id: 'abc', name: 'Morel MW 1258'})).toEqual({source: 'bundled', id: 'abc', name: 'Morel MW 1258'});
  });
  it('leaves the name out when empty, so the wire form is what it was', () => {
    expect(fieldsOf({kind: 'driver_pick', source: 'mine', id: '', name: ''})).toEqual({source: 'mine', id: ''});
  });
});
