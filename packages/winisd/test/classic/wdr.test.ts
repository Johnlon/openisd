/**
 * Unit tests for @openisd/winisd — WDR serialisation (fresh-authored export path).
 *
 * Covers: toWdr fallback branches and parstate E/C/N provenance. Parsing/import is the
 * Driver ADT's job (Driver.fromWdr) — tested in driver-roundtrip.test.ts / roundtrip.test.ts.
 *
 * deriveDriver (pure physics) is imported from @openisd/engine — parstate consumes its
 * output to distinguish entered (E) from computed (C) fields.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { deriveDriver } from '@openisd/engine';
import { toWdr, parstate } from '@openisd/winisd';

// ── toWdr — optional-field branches ──────────────────────────────────────────
// toWdr uses `|| ''` and `|| 0` guards for fields that may be absent.
// These tests exercise the fallback branches.

// Minimal driver for toWdr — no brand, no model, no comment, no Z, no Xmax.
// All of these are optional in the T/S spec.
const BARE_DRIVER = {
  Fs: 37, Qts: 0.38, Qes: 0.40, Qms: 7.0,
  Vas: 0.030, Sd: 0.0133, Re: 5.6, Le: 0.70e-3,
  // Xmax, Pe, Z, brand, model, comment intentionally absent
};

describe('toWdr — missing optional fields use fallback branches', () => {
  it('produces a valid WDR when brand and model are absent — '
   + "Brand= and Model= lines are empty strings (not 'undefined')", () => {
    const wdr = toWdr(BARE_DRIVER);
    assert.match(wdr, /^Brand=$/m, 'Brand line must be empty when brand absent');
    assert.match(wdr, /^Model=$/m, 'Model line must be empty when model absent');
  });

  it('produces a valid WDR when comment is absent — Comment= line is empty string', () => {
    const wdr = toWdr(BARE_DRIVER);
    assert.match(wdr, /^Comment=$/m, 'Comment line must be empty when comment absent');
  });

  it('uses Re as Znom when Z (nominal impedance) is not provided — '
   + 'Znom= falls back to the DC resistance Re', () => {
    const wdr = toWdr(BARE_DRIVER);
    assert.match(wdr, /^Znom=5\.6/m, 'Znom must fall back to Re when Z is absent');
  });

  it('produces Vd=0 when Xmax is absent — zero peak displacement volume', () => {
    const wdr = toWdr(BARE_DRIVER);
    assert.match(wdr, /^Vd=0$/m, 'Vd must be 0 when Xmax is absent');
    assert.match(wdr, /^Xmax=$/m, 'Xmax= must be empty string when Xmax is absent');
  });
});

// ── parstate — WinISD ParState: E (entered) vs C (computed) vs N (absent) ─────
// The 49-char edit-state must distinguish a value the human SUPPLIED (E) from one
// the app DERIVED (C) — presence alone can't (Cms/Bl/Rms/Mms and a derived Q are all
// "present" but computed). parstate(raw, d) compares supplied input against derived
// output. Probe-confirmed positions: Bl=8, Cms=11, Qms=12, Qes=13, Qts=14, Rms=15,
// Mms=16, numVC=23, c=47, roo=48.
describe('parstate — E (entered) vs C (computed) vs N (absent)', () => {
  const FULL = { Fs: 37, Qts: 0.38, Qes: 0.40, Qms: 7.0, Vas: 0.030, Sd: 0.0133, Re: 5.6, Le: 0.7e-3, Xmax: 0.005, Pe: 60, Z: 8 };

  it('is exactly 49 characters', () => {
    const { value: d } = deriveDriver(FULL);
    assert.ok(d);
    assert.equal(parstate(FULL, d).length, 49);
  });

  it('supplied fields are E; always-computed fields (Bl/Cms/Rms/Mms) are C, not E', () => {
    const { value: d } = deriveDriver(FULL);
    assert.ok(d);
    const p = parstate(FULL, d);
    assert.equal(p[1],  'E', 'Fs supplied → E');
    assert.equal(p[2],  'E', 'Pe supplied → E');
    assert.equal(p[9],  'E', 'Xmax supplied → E');
    assert.equal(p[14], 'E', 'Qts supplied → E');
    assert.equal(p[8],  'C', 'Bl is derived → C (present, but NOT entered)');
    assert.equal(p[11], 'C', 'Cms is derived → C');
    assert.equal(p[15], 'C', 'Rms is derived → C');
    assert.equal(p[16], 'C', 'Mms is derived → C');
    assert.equal(p[47], 'C', 'c → C');
    assert.equal(p[48], 'C', 'roo → C');
  });

  it('a DERIVED Q is C while the two ENTERED Qs are E', () => {
    // Enter Qts+Qes only → deriveDriver computes Qms. Qms must read C, not E.
    const twoQ = { Fs: 37, Qts: 0.38, Qes: 0.40, Vas: 0.030, Sd: 0.0133, Re: 5.6, Le: 0.7e-3, Xmax: 0.005, Pe: 60, Z: 8 };
    const { value: d } = deriveDriver(twoQ);
    assert.ok(d);
    const p = parstate(twoQ, d);
    assert.equal(p[14], 'E', 'Qts entered → E');
    assert.equal(p[13], 'E', 'Qes entered → E');
    assert.equal(p[12], 'C', 'Qms was derived, not entered → C');
  });

  it('an absent optional field is N', () => {
    const noOpt = { ...FULL, Pe: undefined, Xmax: undefined };
    const { value: d } = deriveDriver(noOpt);
    assert.ok(d);
    const p = parstate(noOpt, d);
    assert.equal(p[2], 'N', 'Pe absent → N (old hardcoded string wrongly said E)');
    assert.equal(p[9], 'N', 'Xmax absent → N');
    assert.equal(p[28], 'N', 'USPL depends on Pe → N when Pe absent');
    assert.equal(p[14], 'E', 'Qts still supplied → E');
  });

  it('toWdr embeds the computed ParState (49 chars)', () => {
    const wdr = toWdr(FULL);
    const line = wdr.split('\n').find(l => l.startsWith('ParState='));
    assert.ok(line, 'toWdr writes a ParState line');
    assert.equal(line.slice('ParState='.length).length, 49);
  });
});
