import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {formatDateStamp, parseDateStamp} from '../../src/logic/dateDisplay.js';

describe('formatDateStamp', () => {
  it('inserts dashes into an 8-digit YYYYMMDD stamp', () => {
    assert.equal(formatDateStamp('20260929'), '2026-09-29');
  });
  it('passes through anything that is not exactly 8 digits, unchanged', () => {
    assert.equal(formatDateStamp(''), '');
    assert.equal(formatDateStamp('2026'), '2026');
  });
});

describe('parseDateStamp', () => {
  it('strips the dashes back out of a yyyy-mm-dd display string', () => {
    assert.equal(parseDateStamp('2026-09-29'), '20260929');
  });
  it('strips any non-digit character, not just dashes', () => {
    assert.equal(parseDateStamp('2026/09/29'), '20260929');
  });
  it('round-trips through format then parse', () => {
    assert.equal(parseDateStamp(formatDateStamp('20260929')), '20260929');
  });
});
