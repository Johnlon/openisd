/**
 * Unit tests for `driverHasDqIssues` (`packages/ui/src/db/driverRepo.ts`) — pins the current
 * behaviour (Fs/Re presence, the Sd||Vas branch, and the Q-group threshold on both sides of 2).
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { driverHasDqIssues, type FileEntry } from '../../src/db/driverRepo.js';
import type { _OpenISDDriverJson, SpecField } from '@openisd/model';

/** Boilerplate identity/bookkeeping fields every `_OpenISDDriverJson` needs — no domain value
 *  of its own. Only `fields` (SI numbers, keyed by SpecField) varies per test. */
function recordWithFields(fields: Partial<Record<SpecField, number>>): _OpenISDDriverJson {
  const woofer: Record<string, { origin: 'manual'; readings: { manual: { read_value: number } }; dq: [] }> = {};
  for (const [k, v] of Object.entries(fields)) {
    woofer[k] = { origin: 'manual', readings: { manual: { read_value: v } }, dq: [] };
  }
  return {
    uuid: { value: 'test-uuid', definition: 'stable record identity' },
    quality: {
      rating: 'L', confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    manufacturer: { value: 'Test', origin: 'manual', definition: 'the company that makes the driver', dq: [] },
    brand: { value: 'Test', origin: 'manual', definition: 'the selling brand', dq: [] },
    model: { value: 'Model', origin: 'manual', definition: "the vendor's exact designation", dq: [] },
    sku: { value: 'test-model', definition: 'canonical identity code', grounds: [] },
    driver_type: { value: 'woofer', origin: 'manual', definition: 'what kind of driver this is', dq: [] },
        data_sources: { value: {}, definition: 'the record-wide provenance index' },
    authoritative: { value: 'manual', definition: 'which indexed source wins the datasheet waterfall' },
    specs: { woofer: woofer as _OpenISDDriverJson['specs'] extends { woofer?: infer W } ? W : never },
  };
}

describe('driverHasDqIssues — record path (record/myDriverData present)', () => {
  it('is false when Fs, Re, Sd and two of the Q trio are all usable', () => {
    const record = recordWithFields({ Fs: 30, Re: 5.6, Sd: 0.0133, Qts: 0.38, Qes: 0.40 });
    const f: FileEntry = { name: 'x', record };
    assert.equal(driverHasDqIssues(f), false);
  });

  it('is true when Fs is missing', () => {
    const record = recordWithFields({ Re: 5.6, Sd: 0.0133, Qts: 0.38, Qes: 0.40 });
    const f: FileEntry = { name: 'x', record };
    assert.equal(driverHasDqIssues(f), true);
  });

  it('is true when Fs is entered as zero (not > 0)', () => {
    const record = recordWithFields({ Fs: 0, Re: 5.6, Sd: 0.0133, Qts: 0.38, Qes: 0.40 });
    const f: FileEntry = { name: 'x', record };
    assert.equal(driverHasDqIssues(f), true);
  });

  it('is true when Re is missing', () => {
    const record = recordWithFields({ Fs: 30, Sd: 0.0133, Qts: 0.38, Qes: 0.40 });
    const f: FileEntry = { name: 'x', record };
    assert.equal(driverHasDqIssues(f), true);
  });

  it('is false when Sd is absent but Vas is usable (Sd||Vas branch)', () => {
    const record = recordWithFields({ Fs: 30, Re: 5.6, Vas: 0.030, Qts: 0.38, Qes: 0.40 });
    const f: FileEntry = { name: 'x', record };
    assert.equal(driverHasDqIssues(f), false);
  });

  it('is true when neither Sd nor Vas is usable', () => {
    const record = recordWithFields({ Fs: 30, Re: 5.6, Qts: 0.38, Qes: 0.40 });
    const f: FileEntry = { name: 'x', record };
    assert.equal(driverHasDqIssues(f), true);
  });

  it('is false with exactly two of the Q trio usable (Qts absent, Qes+Qms present)', () => {
    const record = recordWithFields({ Fs: 30, Re: 5.6, Sd: 0.0133, Qes: 0.40, Qms: 7.0 });
    const f: FileEntry = { name: 'x', record };
    assert.equal(driverHasDqIssues(f), false);
  });

  it('is true with exactly one of the Q trio usable', () => {
    const record = recordWithFields({ Fs: 30, Re: 5.6, Sd: 0.0133, Qts: 0.38 });
    const f: FileEntry = { name: 'x', record };
    assert.equal(driverHasDqIssues(f), true);
  });

  it('is true with none of the Q trio usable', () => {
    const record = recordWithFields({ Fs: 30, Re: 5.6, Sd: 0.0133 });
    const f: FileEntry = { name: 'x', record };
    assert.equal(driverHasDqIssues(f), true);
  });

  it('myDriverData takes precedence over record when both are set', () => {
    const good = recordWithFields({ Fs: 30, Re: 5.6, Sd: 0.0133, Qts: 0.38, Qes: 0.40 });
    const bad = recordWithFields({ Re: 5.6, Sd: 0.0133, Qts: 0.38, Qes: 0.40 }); // no Fs
    const f: FileEntry = { name: 'x', myDriverData: good, record: bad };
    assert.equal(driverHasDqIssues(f), false);
  });
});

describe('driverHasDqIssues — standing (quality.missing/parse_errors), shared with the bundler', () => {
  it('is true when every field is usable but quality.missing carries an entry', () => {
    const record: _OpenISDDriverJson = {
      uuid: { value: 'test-uuid', definition: 'stable record identity' },
      quality: {
        rating: 'L', confirmed_fields: [], fields_with_issues: [], missing: ['Mms'], invalid: [],
        parse_errors: [], cross_source_only: [],
      },
      manufacturer: { value: 'Test', origin: 'manual', definition: 'the company that makes the driver', dq: [] },
      brand: { value: 'Test', origin: 'manual', definition: 'the selling brand', dq: [] },
      model: { value: 'Model', origin: 'manual', definition: "the vendor's exact designation", dq: [] },
      sku: { value: 'test-model', definition: 'canonical identity code', grounds: [] },
      driver_type: { value: 'woofer', origin: 'manual', definition: 'what kind of driver this is', dq: [] },
            data_sources: { value: {}, definition: 'the record-wide provenance index' },
      authoritative: { value: 'manual', definition: 'which indexed source wins the datasheet waterfall' },
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
    const f: FileEntry = { name: 'x', record };
    assert.equal(driverHasDqIssues(f), true);
  });

  it('is true when every field is usable but quality.parse_errors carries an entry', () => {
    const record: _OpenISDDriverJson = {
      uuid: { value: 'test-uuid', definition: 'stable record identity' },
      quality: {
        rating: 'L', confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
        parse_errors: ['Fs=xx (Hz): not a number'], cross_source_only: [],
      },
      manufacturer: { value: 'Test', origin: 'manual', definition: 'the company that makes the driver', dq: [] },
      brand: { value: 'Test', origin: 'manual', definition: 'the selling brand', dq: [] },
      model: { value: 'Model', origin: 'manual', definition: "the vendor's exact designation", dq: [] },
      sku: { value: 'test-model', definition: 'canonical identity code', grounds: [] },
      driver_type: { value: 'woofer', origin: 'manual', definition: 'what kind of driver this is', dq: [] },
            data_sources: { value: {}, definition: 'the record-wide provenance index' },
      authoritative: { value: 'manual', definition: 'which indexed source wins the datasheet waterfall' },
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
    const f: FileEntry = { name: 'x', record };
    assert.equal(driverHasDqIssues(f), true);
  });
});

// A record with no `quality` block does not reach `driverHasDqIssues` at all: `quality` is
// required by `_OpenISDDriverJson`, and `myDrivers.ts::list()` is the seam that refuses a
// record failing that contract before it is ever handed to this function — see
// `packages/ui/test/db/myDrivers.test.ts` and
// `bugs/BUG_20260822_driverstanding_throws_on_a_record_with_no_quality_block.md`.

describe('driverHasDqIssues — federated row path (no record/myDriverData yet)', () => {
  it('is false when the summary _Fs and _Re are both positive', () => {
    const f: FileEntry = { name: 'x', _Fs: 30, _Re: 5.6 };
    assert.equal(driverHasDqIssues(f), false);
  });

  it('is true when the summary _Fs is missing', () => {
    const f: FileEntry = { name: 'x', _Re: 5.6 };
    assert.equal(driverHasDqIssues(f), true);
  });

  it('is true when the summary _Re is zero', () => {
    const f: FileEntry = { name: 'x', _Fs: 30, _Re: 0 };
    assert.equal(driverHasDqIssues(f), true);
  });

  it('is true when a stated summary _Sd is zero', () => {
    const f: FileEntry = { name: 'x', _Fs: 30, _Re: 5.6, _Sd: 0 };
    assert.equal(driverHasDqIssues(f), true);
  });

  it('is false when the summary _Sd is null (treated as missing, not failing)', () => {
    const f: FileEntry = { name: 'x', _Fs: 30, _Re: 5.6, _Sd: null };
    assert.equal(driverHasDqIssues(f), false);
  });
});
