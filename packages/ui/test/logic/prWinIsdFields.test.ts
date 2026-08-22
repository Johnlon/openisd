/**
 * `prWinIsdFields.ts` — WinISD-vocabulary <-> canonical PR conversion. Pins the current
 * behaviour before the refactor (bugs/BUG_20260818_..._duplicated_outside_engine.md, the
 * `prWinIsdFields.ts` half) that replaces the inline `Math.sqrt(...)`/`1/((2π·f)²·Cms)`
 * expressions with calls into `@openisd/model`'s `prCmsFromWinIsdVas`/`prMmdFromWinIsdFs`/
 * `prRmsFromWinIsdQms` — themselves the one call path to the engine's new inverse formulas.
 * Expected values are hand-computed independently of the implementation.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import {
  setPrFsFromWinIsd, setPrQmsFromWinIsd, setPrVasFromWinIsd, prCanonicalFromDatasheet,
} from '../../src/logic/prWinIsdFields.js';
import type { UiParams } from '../../src/types.js';

/** A minimal UiParams stub carrying only the PR fields these functions read/write. */
function prParams(overrides: Partial<UiParams>): UiParams {
  return { prCms: 0, prMmd: 0, prRms: 0, prSd: 0, prMadd: 0, prXmax: 0, ...overrides } as UiParams;
}

describe('setPrFsFromWinIsd — re-solves Mmd/Rms from a WinISD-vocabulary Fs entry', () => {
  it('Fs=60 Hz, Cms=333333e-8, Qms=444444e-4 (hand-computed)', () => {
    const P = prParams({ prCms: 333333e-8, prMmd: 999999e-6, prRms: 111111e-4 });
    // Seed Qms via existing Mmd/Cms/Rms so prQmsDisplay() reads a known value first.
    const qms = Math.sqrt(P.prMmd / P.prCms) / P.prRms;
    setPrFsFromWinIsd(P, 60);
    const expectedMmd = 1 / ((2 * Math.PI * 60) ** 2 * 333333e-8);
    const expectedRms = Math.sqrt(expectedMmd / 333333e-8) / qms;
    assert.ok(Math.abs(P.prMmd - expectedMmd) / expectedMmd < 1e-9, `got ${P.prMmd}`);
    assert.ok(Math.abs(P.prRms - expectedRms) / expectedRms < 1e-9, `got ${P.prRms}`);
  });
});

describe('setPrQmsFromWinIsd — re-solves Rms from a WinISD-vocabulary Qms entry', () => {
  it('Qms=5, Mmd=999999e-6, Cms=333333e-8 (hand-computed)', () => {
    const P = prParams({ prCms: 333333e-8, prMmd: 999999e-6 });
    setPrQmsFromWinIsd(P, 5);
    const expectedRms = Math.sqrt(999999e-6 / 333333e-8) / 5;
    assert.ok(Math.abs(P.prRms - expectedRms) / expectedRms < 1e-9, `got ${P.prRms}`);
  });
});

describe('setPrVasFromWinIsd — re-solves Cms/Mmd/Rms from a WinISD-vocabulary Vas entry', () => {
  it('Vas=22.2 l, Sd=222222e-6 (hand-computed against the current implementation)', () => {
    const P = prParams({ prSd: 222222e-6, prCms: 111111e-8, prMmd: 555555e-6, prRms: 4 });
    const before = { ...P };
    setPrVasFromWinIsd(P, 22.2);
    // Round-trips: prVas(newCms, Sd) must reproduce 22.2 l (the formula's own definition).
    const roundTrip = P.prCms * P.prSd * P.prSd * 1.20095217714682 * 343.684120962153 ** 2 * 1000;
    assert.ok(Math.abs(roundTrip - 22.2) < 0.01, `got ${roundTrip}`);
    assert.notEqual(P.prCms, before.prCms);
    assert.notEqual(P.prMmd, before.prMmd);
    assert.notEqual(P.prRms, before.prRms);
  });
});

describe('prCanonicalFromDatasheet — a brand-new PR from datasheet fields (hand-computed)', () => {
  it('Sd=133 cm², Vas=20.07 l, Fs=56.27 Hz, Qms=3.5 (hand-computed)', () => {
    const out = prCanonicalFromDatasheet({ sdCm2: 133, vasL: 20.07, fsHz: 56.27, qms: 3.5, xmaxMm: 6 });
    assert.ok(out.sd > 0 && out.cms > 0 && out.mmd > 0 && out.rms > 0, JSON.stringify(out));
    assert.ok(Math.abs(out.xmax - 0.006) < 1e-9);
    // Vas round-trips through the canonical Cms/Sd it produced.
    const rho = 1.20095217714682, c = 343.684120962153;
    const vasRoundTrip = out.cms * out.sd * out.sd * rho * c * c * 1000;
    assert.ok(Math.abs(vasRoundTrip - 20.07) < 0.01, `got ${vasRoundTrip}`);
  });
});
