import {describe, expect, it, vi} from 'vitest';
import type {BundledPassiveRadiatorIndexRow, BundledPassiveRadiatorRepo} from '@openisd/persistence';
import {radiatorPickRecorder} from '../../src/logic/telemetry/radiatorPick.js';
import {fieldsOf, type TelemetryEvent} from '../../src/logic/telemetry/events.js';
import type {Telemetry} from '../../src/logic/telemetry/telemetry.js';

function recorderOver(index: BundledPassiveRadiatorRepo['index']) {
  const record = vi.fn<(e: TelemetryEvent) => void>();
  const telemetry: Telemetry = {record, flush: vi.fn()};
  const catalogue: BundledPassiveRadiatorRepo = {index, load: vi.fn()};
  return {record, picks: radiatorPickRecorder(telemetry, catalogue)};
}

const ND140_PR: BundledPassiveRadiatorIndexRow = {
  uuid: 'pr-1', path: 'dayton/nd140-pr', name: 'Dayton Audio ND140-PR', dq: false, datasheet: null, productPage: null, listingPage: null,
  Fs_hz: null, Sd_m2: null, Xmax_m: null, Vd_m3: null, Mms_kg: null, Cms_m_per_N: null, Vas_m3: null, Qms: null,
};

describe('radiatorPickRecorder (John 10 Nov 2026: "also record the pr picked either on Wiz or in main")', () => {
  it('a catalogue radiator is recorded with its id and its catalogue name', async () => {
    const {record, picks} = recorderOver(async () => [ND140_PR]);
    picks.bundled('pr-1');
    await vi.waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    expect(record).toHaveBeenCalledWith({kind: 'radiator_pick', source: 'bundled', id: 'pr-1', name: 'Dayton Audio ND140-PR'});
  });

  it('a catalogue that cannot be read still records the bundled id', async () => {
    const {record, picks} = recorderOver(async () => { throw new Error('offline'); });
    picks.bundled('pr-1');
    await vi.waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    expect(record).toHaveBeenCalledWith({kind: 'radiator_pick', source: 'bundled', id: 'pr-1', name: ''});
  });

  it('a saved radiator is recorded as mine, with no id and no name', () => {
    const {record, picks} = recorderOver(async () => []);
    picks.saved();
    expect(record).toHaveBeenCalledWith({kind: 'radiator_pick', source: 'mine', id: '', name: ''});
  });

  it('goes on the wire as source, id and name, the name left out when empty', () => {
    expect(fieldsOf({kind: 'radiator_pick', source: 'bundled', id: 'pr-1', name: 'Dayton Audio ND140-PR'})).toEqual({source: 'bundled', id: 'pr-1', name: 'Dayton Audio ND140-PR'});
    expect(fieldsOf({kind: 'radiator_pick', source: 'mine', id: '', name: ''})).toEqual({source: 'mine', id: ''});
  });
});
