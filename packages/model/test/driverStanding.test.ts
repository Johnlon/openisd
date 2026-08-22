import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { recordStandingIsOk } from '../src/driverStanding.js';

describe('recordStandingIsOk', () => {
  it('is true when missing and parse_errors are both empty', () => {
    assert.equal(recordStandingIsOk({ missing: [], parse_errors: [] }), true);
  });

  it('is false when missing carries a field', () => {
    assert.equal(recordStandingIsOk({ missing: ['Mms'], parse_errors: [] }), false);
  });

  it('is false when parse_errors carries an entry', () => {
    assert.equal(recordStandingIsOk({ missing: [], parse_errors: ['Fs=xx: not a number'] }), false);
  });

  it('is false when both carry entries', () => {
    assert.equal(recordStandingIsOk({ missing: ['Mms'], parse_errors: ['Fs=xx: not a number'] }), false);
  });

  // `quality.missing`/`quality.parse_errors` are required by `_OpenISDDriverJson`, so this
  // function assumes both are present arrays — it is never handed a record failing that
  // contract, because `myDrivers.ts::list()` refuses a non-conforming record at the seam
  // (`bugs/BUG_20260822_driverstanding_throws_on_a_record_with_no_quality_block.md`).
});
