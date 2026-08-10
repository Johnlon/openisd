/**
 * Specification: http://localhost:8000/winisd/openisd/openspec/specs/driver-database/spec.md?html
 */
/**
 * deriveOpenISDFields — tested against the exact real-WinISD fixtures already verified
 * this session (winisd_research/CALC_FINDINGS_FOR_REVIEW.md, DISCOVERIES.md), not
 * synthetic numbers, so a regression here is a regression against WinISD itself.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { deriveOpenISDFields } from '../../src/native/openisdDerive.js';

// Beyma 10BR60/V2 real values, this session's batch-recompute fixture
// (CALC_FINDINGS_FOR_REVIEW.md "Rms, Cms recompute correctly on delete; Re ALSO recomputes").
const BEYMA = { Fs: 29.0, Mms: 0.044, Cms: 0.000693, Rms: 2.4, Bl: 10.9, Re: 6.5, Qes: 0.44, Qms: 3.3, Sd: 0.038 };

describe('deriveOpenISDFields — extracted logic (Driver#derive() parity)', () => {
  it('Dia from Sd, both directions', () => {
    const { fields } = deriveOpenISDFields({ Sd: 0.038 });
    assert.ok(Math.abs(fields.Dia - 0.2200) < 0.001, `Dia=${fields.Dia}, expected ~0.220`);
  });

  it('Qts from Qes+Qms', () => {
    const { fields } = deriveOpenISDFields({ Qes: 0.44, Qms: 3.3 });
    assert.ok(Math.abs(fields.Qts - (0.44 * 3.3 / (0.44 + 3.3))) < 1e-9);
  });

  it('never overwrites an entered value — WinISD fixed-E semantics', () => {
    const { fields } = deriveOpenISDFields({ Sd: 0.038, Dia: 0.999 });
    assert.equal(fields.Dia, 0.999, 'entered Dia must survive even though Sd could derive a different one');
  });
});

describe('deriveOpenISDFields — NEW directions, GAPS.md §A4', () => {
  it('Fs from Mms+Cms matches WinISD exactly (28.82, this session\'s live-tested value)', () => {
    const { fields } = deriveOpenISDFields({ Mms: BEYMA.Mms, Cms: BEYMA.Cms });
    assert.ok(Math.abs(fields.Fs - 28.82) < 0.01, `Fs=${fields.Fs}, WinISD shows 28.82`);
  });

  it('Re from Qes+BL+Fs+Mms reproduces the naive hand-calc (6.520), NOT WinISD\'s own ' +
     '6.439 — BUG-006 is open and this must not silently curve-fit it', () => {
    const { fields } = deriveOpenISDFields({ Qes: BEYMA.Qes, Bl: BEYMA.Bl, Fs: BEYMA.Fs, Mms: BEYMA.Mms });
    assert.ok(Math.abs(fields.Re - 6.520) < 0.001, `Re=${fields.Re}, expected the documented hand-calc 6.520`);
    assert.ok(Math.abs(fields.Re - 6.439) > 0.01, 'must NOT silently match WinISD\'s value — that gap is unexplained (BUG-006)');
  });
});
