/**
 * @openisd/winisd — Driver projections for the UI store (Phase 4c).
 *
 * Seam: the store holds a long-lived Driver and needs three projections off it —
 *   • fromRaw(raw)  — build a Driver from a plain DriverRaw bag (metadata + T/S)
 *   • raw()         — the ENTERED bag back out (E fields + carried metadata; NOT
 *                     computed C fields), for the legacy driverRaw readers & re-save
 *   • toDriver()    — the fully-derived engine Driver for the simulation (or null)
 *
 * Expected values come from independent sources: the closed-form T/S equations and
 * WinISD's fixed-E override semantics — not from the code under test.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Driver } from '@openisd/winisd';

const RHO = 1.20095, C = 343.68;   // engine constants (WinISD 20 °C — independent restatement)

describe('Driver.fromRaw — build from a plain DriverRaw bag', () => {
  it('enters every present field: numerics → E value, metadata strings → E', () => {
    const d = Driver.fromRaw({ name: 'Demo', brand: 'Demo', Fs: 37, Re: 5.6 });
    assert.equal(d.cell('Fs').value, 37);
    assert.equal(d.cell('Fs').state, 'E');
    assert.equal(d.cell('name').value, 'Demo');
    assert.equal(d.cell('name').state, 'E');
    assert.equal(d.cell('brand').state, 'E');
  });

  it('skips undefined / null / empty fields (they stay N)', () => {
    const d = Driver.fromRaw({ Fs: 37, Vas: undefined, Le: null as unknown as number, comment: '' });
    assert.equal(d.cell('Vas').state, 'N');
    assert.equal(d.cell('comment').state, 'N');
  });
});

describe('Driver.raw — the entered bag back out', () => {
  it('returns entered numerics and metadata, but NOT computed C fields', () => {
    const d = Driver.fromRaw({ name: 'Demo', Fs: 37, Qes: 0.4, Qms: 7, Vas: 0.03, Sd: 0.0133, Re: 5.6 });
    const r = d.raw() as Record<string, unknown>;
    assert.equal(r.Fs, 37);
    assert.equal(r.name, 'Demo');
    // Qts/Cms/Mms/Bl are DERIVED (C) here — must not leak into the entered bag.
    assert.ok(!('Qts' in r), 'derived Qts must not appear in raw()');
    assert.ok(!('Cms' in r), 'derived Cms must not appear in raw()');
    assert.ok(!('Bl'  in r), 'derived Bl must not appear in raw()');
  });

  it('a round-trip through fromRaw→raw is stable for entered fields', () => {
    const src = { name: 'X', Fs: 40, Qts: 0.35, Qes: 0.4, Qms: 5, Vas: 0.02, Sd: 0.012, Re: 6, Le: 0.0005, Xmax: 0.004, Pe: 50 };
    const r = Driver.fromRaw(src).raw() as Record<string, unknown>;
    for (const [k, v] of Object.entries(src)) assert.equal(r[k], v, `${k} must survive fromRaw→raw`);
  });
});

describe('Driver.toDriver — the derived engine Driver for the sim', () => {
  it('returns the full derived set (Cms/Mms/Bl) for a valid driver', () => {
    const d = Driver.fromRaw({ Fs: 37, Qes: 0.4, Qms: 7, Vas: 0.03, Sd: 0.0133, Re: 5.6 });
    const dv = d.toDriver();
    assert.ok(dv, 'valid driver derives');
    // Independent: Cms = Vas/(ρc²·Sd²)
    const expCms = 0.03 / (RHO * C * C) / (0.0133 * 0.0133);
    assert.ok(Math.abs((dv!.Cms as number) - expCms) < expCms * 1e-9, `Cms ${dv!.Cms} vs ${expCms}`);
    assert.ok((dv!.Bl as number) > 0);
    // Qts derived from the two entered Q's
    const expQts = (0.4 * 7) / (0.4 + 7);
    assert.ok(Math.abs((dv!.Qts as number) - expQts) < 1e-12);
  });

  it('returns null when the driver has a blocking error (Re missing)', () => {
    const d = Driver.fromRaw({ Fs: 37, Qes: 0.4, Qms: 7, Vas: 0.03, Sd: 0.0133 });
    assert.equal(d.toDriver(), null);
  });

  it('honours a fixed-E override: entered Cms sticks in the derived driver', () => {
    const d = Driver.fromRaw({ Fs: 37, Qes: 0.4, Qms: 7, Vas: 0.03, Sd: 0.0133, Re: 5.6 });
    d.enter('Cms', 0.001);
    assert.equal(d.toDriver()!.Cms, 0.001);
  });
});

describe('Driver.fromWdr — metadata is carried into the entered bag', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const SAMPLE = join(here, '..', '..', '..', 'drivers', 'sample', 'SEAS_Prestige_L19RNX1.wdr');
  const text = readFileSync(SAMPLE, 'utf8');

  it('raw() exposes brand/model/name from the WDR header, marked E', () => {
    const d = Driver.fromWdr(text);
    const r = d.raw() as Record<string, unknown>;
    assert.equal(r.brand, 'SEAS Prestige');
    assert.equal(r.model, 'L19RNX1');
    assert.equal(r.name, 'SEAS Prestige L19RNX1');
    assert.equal(d.cell('brand').state, 'E');
  });
});
