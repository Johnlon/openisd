/** slimmedProjectSession on hand-made sessions: every shape the stored text may hold. */
import {NULL_GUID} from '../../../domain/project/nullDriverId.js';
import {describe, expect, it} from 'vitest';
import {slimmedProjectSession} from '../../../domain/project/slimDriver.js';

function embedding(device: Record<string, unknown>): Record<string, unknown> {
  return {driverEmbedding: {device}};
}

describe('slimmedProjectSession', () => {
  it('returns a non-object session as it was', () => {
    expect(slimmedProjectSession(7)).toBe(7);
    expect(slimmedProjectSession(null)).toBeNull();
  });

  it('leaves a project without an embedded device as it was', () => {
    const session = {saved: 5, edited: {driverEmbedding: 3}};
    expect(slimmedProjectSession(session)).toEqual({saved: 5, edited: {driverEmbedding: 3}});
    expect(slimmedProjectSession({saved: {driverEmbedding: {device: 1}}, edited: null}))
      .toEqual({saved: {driverEmbedding: {device: 1}}, edited: null});
  });

  it('cuts a device with every optional key to what the editor shows', () => {
    const device = {
      uuid: {value: 'u', origin: 'x'}, manufacturer: {value: 'M', origin: 'x'}, brand: 'B', model: {value: 'Mo'},
      sku: 'SKU', driver_type: {value: 'woofer', origin: 'y'}, provided_by: {value: 'p', origin: 'z'}, comment: {value: 'c'},
      added: 'plain', quality: {missing: ['a']}, data_sources: {value: {a: 1}},
      specs: {
        woofer: {
          Fs_hz: {state: 'E', value: 30, precision: 0.5, origin: 'a', readings: {a: {read_value: 30}}},
          Qts: {state: 'E', value: 0.4},
          Re_ohm: {state: 'C', value: 6, precision: 0.1, dq_calculated: []},
          Qes: {state: 'C', value: 0.5},
          Vas_m3: {state: 'N', readings: {a: {actual_reading: 'N/A', rejected: 'no-numeric-value'}}},
          Mms_kg: 'not an entry',
        },
        tweeter: 9,
      },
    };
    const out = slimmedProjectSession({saved: embedding(device), edited: null, label: 'L'});
    expect(out).toEqual({
      label: 'L', edited: null,
      saved: {driverEmbedding: {device: {
        uuid: {value: NULL_GUID}, quality: {missing: [], invalid: [], parse_errors: [], cross_source_only: []},
        manufacturer: {value: 'M'}, brand: 'B', model: {value: 'Mo'}, sku: 'SKU', driver_type: {value: 'woofer'},
        data_sources: {value: {}}, provided_by: {value: 'p'}, comment: {value: 'c'}, added: 'plain',
        specs: {
          woofer: {
            Fs_hz: {state: 'E', value: 30, precision: 0.5},
            Qts: {state: 'E', value: 0.4},
            Re_ohm: {state: 'C', value: 6, precision: 0.1},
            Qes: {state: 'C', value: 0.5},
            Vas_m3: {state: 'N', readings: {a: {actual_reading: 'N/A', rejected: 'no-numeric-value'}}},
            Mms_kg: 'not an entry',
          },
          tweeter: 9,
        },
      }}},
    });
  });

  it('adds no specs to a device that has none', () => {
    const out = slimmedProjectSession({saved: embedding({sku: 'S'}), edited: null});
    expect(out).toEqual({saved: {driverEmbedding: {device: {
      uuid: {value: NULL_GUID}, quality: {missing: [], invalid: [], parse_errors: [], cross_source_only: []}, sku: 'S', data_sources: {value: {}},
    }}}, edited: null});
  });

  it('keeps only the quality summary and sources of a bare device, and a non-record specs value', () => {
    const out = slimmedProjectSession({saved: embedding({specs: 4}), edited: null});
    expect(out).toEqual({saved: {driverEmbedding: {device: {
      uuid: {value: NULL_GUID}, quality: {missing: [], invalid: [], parse_errors: [], cross_source_only: []}, data_sources: {value: {}}, specs: 4,
    }}}, edited: null});
  });

  it('drops a spec key whose entry is undefined', () => {
    const out = slimmedProjectSession({saved: embedding({specs: {woofer: {Fs_hz: undefined}}}), edited: null});
    expect(out).toEqual({saved: {driverEmbedding: {device: {
      uuid: {value: NULL_GUID}, quality: {missing: [], invalid: [], parse_errors: [], cross_source_only: []}, data_sources: {value: {}}, specs: {woofer: {}},
    }}}, edited: null});
  });
});
