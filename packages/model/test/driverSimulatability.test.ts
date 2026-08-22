import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { recordIsSimulatable } from '../src/driverSimulatability.js';
import type { _OpenISDDriverJson } from '../src/openisdDriver.js';

describe('recordIsSimulatable', () => {
  it('is true when Fs, Re, Sd and two of the Q trio are all usable', () => {
    const record: _OpenISDDriverJson = {
      uuid: { value: 'test-uuid', definition: 'stable record identity' },
      quality: {
        rating: 'L', confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      manufacturer: { value: 'Test', origin: 'manual', definition: 'x', dq: [] },
      brand: { value: 'Test', origin: 'manual', definition: 'x', dq: [] },
      model: { value: 'Model', origin: 'manual', definition: 'x', dq: [] },
      sku: { value: 'test-model', definition: 'x', grounds: [] },
      driver_type: { value: 'woofer', origin: 'manual', definition: 'x', dq: [] },
      data_sources: { value: {}, definition: 'x' },
      authoritative: { value: 'manual', definition: 'x' },
      specs: {
        woofer: {
          Fs: { origin: 'manual', readings: { manual: { read_value: 30 } }, dq: [] },
          Re: { origin: 'manual', readings: { manual: { read_value: 5.6 } }, dq: [] },
          Sd: { origin: 'manual', readings: { manual: { read_value: 0.0133 } }, dq: [] },
          Qts: { origin: 'manual', readings: { manual: { read_value: 0.38 } }, dq: [] },
          Qes: { origin: 'manual', readings: { manual: { read_value: 0.40 } }, dq: [] },
        },
      },
    };
    assert.equal(recordIsSimulatable(record), true);
  });

  it('is false when Fs is missing', () => {
    const record: _OpenISDDriverJson = {
      uuid: { value: 'test-uuid', definition: 'stable record identity' },
      quality: {
        rating: 'L', confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      manufacturer: { value: 'Test', origin: 'manual', definition: 'x', dq: [] },
      brand: { value: 'Test', origin: 'manual', definition: 'x', dq: [] },
      model: { value: 'Model', origin: 'manual', definition: 'x', dq: [] },
      sku: { value: 'test-model', definition: 'x', grounds: [] },
      driver_type: { value: 'woofer', origin: 'manual', definition: 'x', dq: [] },
      data_sources: { value: {}, definition: 'x' },
      authoritative: { value: 'manual', definition: 'x' },
      specs: {
        woofer: {
          Re: { origin: 'manual', readings: { manual: { read_value: 5.6 } }, dq: [] },
          Sd: { origin: 'manual', readings: { manual: { read_value: 0.0133 } }, dq: [] },
          Qts: { origin: 'manual', readings: { manual: { read_value: 0.38 } }, dq: [] },
          Qes: { origin: 'manual', readings: { manual: { read_value: 0.40 } }, dq: [] },
        },
      },
    };
    assert.equal(recordIsSimulatable(record), false);
  });

  it('is true when quality.missing carries a non-simulation field (Cms) — QO79: usability, not completeness, gates', () => {
    const record: _OpenISDDriverJson = {
      uuid: { value: 'test-uuid', definition: 'stable record identity' },
      quality: {
        rating: 'L', confirmed_fields: [], fields_with_issues: [], missing: ['Cms'], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      manufacturer: { value: 'Test', origin: 'manual', definition: 'x', dq: [] },
      brand: { value: 'Test', origin: 'manual', definition: 'x', dq: [] },
      model: { value: 'Model', origin: 'manual', definition: 'x', dq: [] },
      sku: { value: 'test-model', definition: 'x', grounds: [] },
      driver_type: { value: 'woofer', origin: 'manual', definition: 'x', dq: [] },
      data_sources: { value: {}, definition: 'x' },
      authoritative: { value: 'manual', definition: 'x' },
      specs: {
        woofer: {
          Fs: { origin: 'manual', readings: { manual: { read_value: 30 } }, dq: [] },
          Re: { origin: 'manual', readings: { manual: { read_value: 5.6 } }, dq: [] },
          Sd: { origin: 'manual', readings: { manual: { read_value: 0.0133 } }, dq: [] },
          Qts: { origin: 'manual', readings: { manual: { read_value: 0.38 } }, dq: [] },
          Qes: { origin: 'manual', readings: { manual: { read_value: 0.40 } }, dq: [] },
        },
      },
    };
    assert.equal(recordIsSimulatable(record), true);
  });

  it('is true when Sd is absent but Vas is usable', () => {
    const record: _OpenISDDriverJson = {
      uuid: { value: 'test-uuid', definition: 'stable record identity' },
      quality: {
        rating: 'L', confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      manufacturer: { value: 'Test', origin: 'manual', definition: 'x', dq: [] },
      brand: { value: 'Test', origin: 'manual', definition: 'x', dq: [] },
      model: { value: 'Model', origin: 'manual', definition: 'x', dq: [] },
      sku: { value: 'test-model', definition: 'x', grounds: [] },
      driver_type: { value: 'woofer', origin: 'manual', definition: 'x', dq: [] },
      data_sources: { value: {}, definition: 'x' },
      authoritative: { value: 'manual', definition: 'x' },
      specs: {
        woofer: {
          Fs: { origin: 'manual', readings: { manual: { read_value: 30 } }, dq: [] },
          Re: { origin: 'manual', readings: { manual: { read_value: 5.6 } }, dq: [] },
          Vas: { origin: 'manual', readings: { manual: { read_value: 0.03 } }, dq: [] },
          Qts: { origin: 'manual', readings: { manual: { read_value: 0.38 } }, dq: [] },
          Qes: { origin: 'manual', readings: { manual: { read_value: 0.40 } }, dq: [] },
        },
      },
    };
    assert.equal(recordIsSimulatable(record), true);
  });

  it('is false with fewer than two of the Q trio usable', () => {
    const record: _OpenISDDriverJson = {
      uuid: { value: 'test-uuid', definition: 'stable record identity' },
      quality: {
        rating: 'L', confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      manufacturer: { value: 'Test', origin: 'manual', definition: 'x', dq: [] },
      brand: { value: 'Test', origin: 'manual', definition: 'x', dq: [] },
      model: { value: 'Model', origin: 'manual', definition: 'x', dq: [] },
      sku: { value: 'test-model', definition: 'x', grounds: [] },
      driver_type: { value: 'woofer', origin: 'manual', definition: 'x', dq: [] },
      data_sources: { value: {}, definition: 'x' },
      authoritative: { value: 'manual', definition: 'x' },
      specs: {
        woofer: {
          Fs: { origin: 'manual', readings: { manual: { read_value: 30 } }, dq: [] },
          Re: { origin: 'manual', readings: { manual: { read_value: 5.6 } }, dq: [] },
          Sd: { origin: 'manual', readings: { manual: { read_value: 0.0133 } }, dq: [] },
          Qts: { origin: 'manual', readings: { manual: { read_value: 0.38 } }, dq: [] },
        },
      },
    };
    assert.equal(recordIsSimulatable(record), false);
  });
});
