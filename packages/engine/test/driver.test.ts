/**
 * Unit tests for src/core/driver.js
 *
 * Covers: deriveDriver {value,errors} contract, Q-derivation branches,
 * parseWdr (including sidecar), _parseSimpleYaml (via sidecar), and toWdr/parseWdr round-trip.
 *
 * Q-factor formulas: https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 *   Qts = (Qes · Qms) / (Qes + Qms)
 *   Qes = (Qts · Qms) / (Qms − Qts)   [inverse]
 *   Qms = (Qts · Qes) / (Qes − Qts)   [inverse]
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { deriveDriver, parseWdr, toWdr } from '@resonate/engine';

// ── Q-derivation test values ─────────────────────────────────────────────────
const QES = 0.400;    // electrical Q — resistance damping from voice coil
const QMS = 7.000;    // mechanical Q — damping from spider / surround
// Qts derived from QES and QMS via Thiele/Small combination formula
const QTS_DERIVED = (QES * QMS) / (QES + QMS);   // ≈ 0.37838

// Floating-point tolerance for algebraically-derived Q values.
// These computations are closed-form with no measurement rounding,
// so double-precision error should be well below 1e-10.
const Q_TOL = 1e-10;

// Base driver params (mechanical + electrical, no Q value — Q supplied per test)
const BASE = {
  Fs: 37,        // resonant frequency, Hz
  Vas: 0.030,    // acoustic compliance volume, m³
  Sd: 0.0133,    // effective piston area, m²
  Re: 5.6,       // DC resistance, Ω
  Le: 0.70e-3,   // voice-coil inductance, H
  Xmax: 0.005,   // peak linear excursion, m
  Pe: 60,        // rated power, W
  Z: 8,          // nominal impedance, Ω
};

// ── Minimal WDR text for parseWdr tests ─────────────────────────────────────
// Contains every field required for a complete T/S set:
//   Fs, Sd, Re, Vas must be present; at least two of {Qts, Qes, Qms} must be present.
const MINIMAL_WDR = `[Driver]
Brand=TestBrand
Model=TestModel
Fs=37
Qts=0.38
Qes=0.40
Qms=7.0
Vas=0.030
Sd=0.0133
Re=5.6
Le=0.0007
Xmax=0.005
Pe=60
Znom=8
`;

// ── deriveDriver — {value, errors} contract ───────────────────────────────────

describe('deriveDriver — {value, errors} contract', () => {
  it('returns an object with value and errors properties — never a bare driver or a throw', () => {
    const result = deriveDriver({ ...BASE, Qes: QES, Qms: QMS });
    assert.ok('value' in result, 'must have value property');
    assert.ok('errors' in result, 'must have errors property');
    assert.ok(Array.isArray(result.errors), 'errors must be an array');
  });

  it('errors is empty for a complete valid driver — no spurious warnings on good input', () => {
    const { errors } = deriveDriver({ ...BASE, Qes: QES, Qms: QMS });
    assert.deepEqual(errors, [], 'no errors expected for complete valid driver');
  });

  it('value is non-null for a complete valid driver — all T/S fields present means usable result', () => {
    const { value } = deriveDriver({ ...BASE, Qes: QES, Qms: QMS });
    assert.ok(value != null, 'value must not be null for complete input');
  });

  it('returns value:null and field-level error for Fs when Fs is missing', () => {
    const { value, errors } = deriveDriver({ ...BASE, Qes: QES, Qms: QMS, Fs: undefined });
    assert.equal(value, null, 'value must be null when Fs is missing');
    const e = errors.find(e => e.field === 'Fs');
    assert.ok(e, 'must have an error entry for field Fs');
    assert.equal(e.level, 'error', 'Fs error must be level:error');
    assert.ok(typeof e.message === 'string' && e.message.length > 0, 'must have a non-empty human-readable message');
  });

  it('returns value:null and field-level error for Re when Re is missing', () => {
    const { value, errors } = deriveDriver({ ...BASE, Qes: QES, Qms: QMS, Re: undefined });
    assert.equal(value, null);
    const e = errors.find(e => e.field === 'Re');
    assert.ok(e && e.level === 'error', 'must have level:error entry for Re');
  });

  it('returns value:null and field-level error for Sd when Sd is missing', () => {
    const { value, errors } = deriveDriver({ ...BASE, Qes: QES, Qms: QMS, Sd: undefined });
    assert.equal(value, null);
    const e = errors.find(e => e.field === 'Sd');
    assert.ok(e && e.level === 'error', 'must have level:error entry for Sd');
  });

  it('returns value:null and field-level error for Vas when Vas is missing', () => {
    const { value, errors } = deriveDriver({ ...BASE, Qes: QES, Qms: QMS, Vas: undefined });
    assert.equal(value, null);
    const e = errors.find(e => e.field === 'Vas');
    assert.ok(e && e.level === 'error', 'must have level:error entry for Vas');
  });

  it('returns value:null and error when fewer than two Q parameters are present', () => {
    // Qts alone cannot resolve Qes or Qms — underdetermined system
    const { value, errors } = deriveDriver({ ...BASE, Qts: QTS_DERIVED });
    assert.equal(value, null, 'value must be null when Q system is underdetermined');
    assert.ok(errors.some(e => e.level === 'error'), 'must have at least one error');
  });

  it('returns value:null when Fs is zero — zero frequency is not physically valid', () => {
    const { value, errors } = deriveDriver({ ...BASE, Qes: QES, Qms: QMS, Fs: 0 });
    assert.equal(value, null);
    assert.ok(errors.some(e => e.field === 'Fs'), 'must have Fs error entry');
  });

  it('returns non-null value and a warn for Pe when Pe is absent — Pe is optional, driver is still usable', () => {
    const { value, errors } = deriveDriver({ ...BASE, Qes: QES, Qms: QMS, Pe: undefined });
    assert.ok(value != null, 'value must not be null — Pe absence does not block derivation');
    const w = errors.find(e => e.field === 'Pe' && e.level === 'warn');
    assert.ok(w, 'must have a level:warn entry for Pe when absent');
    assert.ok(typeof w.message === 'string' && w.message.length > 0, 'warn message must be non-empty');
  });

  it('returns non-null value and a warn for Pe when Pe is zero — zero Pe same treatment as absent', () => {
    const { value, errors } = deriveDriver({ ...BASE, Qes: QES, Qms: QMS, Pe: 0 });
    assert.ok(value != null, 'value must not be null for Pe=0');
    const w = errors.find(e => e.field === 'Pe' && e.level === 'warn');
    assert.ok(w, 'must have a level:warn entry for Pe=0');
  });

  // ── edge cases ──────────────────────────────────────────────────────────────

  it('a Pe warn alone (all required fields present) does not block the value — warn ≠ error', () => {
    // The critical distinction: warn-level entries must NOT null the value.
    const { value, errors } = deriveDriver({ ...BASE, Qes: QES, Qms: QMS, Pe: 0 });
    assert.ok(value != null, 'warn-only result must keep a usable value');
    assert.ok(!errors.some(e => e.level === 'error'), 'Pe=0 alone produces no error-level entry');
  });

  it('negative Fs is rejected the same as zero/absent — Fs must be strictly positive', () => {
    const { value, errors } = deriveDriver({ ...BASE, Qes: QES, Qms: QMS, Fs: -37 });
    assert.equal(value, null);
    assert.ok(errors.some(e => e.field === 'Fs' && e.level === 'error'), 'negative Fs must be an error');
  });

  it('negative Re is rejected — resistance must be strictly positive', () => {
    const { value, errors } = deriveDriver({ ...BASE, Qes: QES, Qms: QMS, Re: -5.6 });
    assert.equal(value, null);
    assert.ok(errors.some(e => e.field === 'Re' && e.level === 'error'));
  });

  it('NaN Fs is rejected — NaN must not slip through the > 0 guard', () => {
    const { value, errors } = deriveDriver({ ...BASE, Qes: QES, Qms: QMS, Fs: NaN });
    assert.equal(value, null);
    assert.ok(errors.some(e => e.field === 'Fs' && e.level === 'error'));
  });

  it('multiple missing required fields accumulate one error entry per field — not just the first', () => {
    // Fs, Re, Sd, Vas all absent → four distinct error entries, all fields named.
    const { value, errors } = deriveDriver({ Qes: QES, Qms: QMS });
    assert.equal(value, null);
    const errFields = new Set(errors.filter(e => e.level === 'error').map(e => e.field));
    for (const f of ['Fs', 'Re', 'Sd', 'Vas']) {
      assert.ok(errFields.has(f), `expected an error entry for ${f}; got fields ${[...errFields].join(', ')}`);
    }
  });

  it('a completely empty driver produces errors but never throws and never returns undefined', () => {
    const result = deriveDriver({});
    assert.ok(result && Array.isArray(result.errors), 'must return {value, errors} even for {}');
    assert.equal(result.value, null);
    assert.ok(result.errors.length > 0, 'empty driver must report at least one error');
  });

  it('every error entry has field, level, and a non-empty human-readable message', () => {
    // Contract guarantee the UI relies on to render per-field messages.
    const { errors } = deriveDriver({});
    for (const e of errors) {
      assert.ok(typeof e.field === 'string' && e.field.length > 0, 'field must be a non-empty string');
      assert.ok(e.level === 'error' || e.level === 'warn', `level must be error|warn, got ${e.level}`);
      assert.ok(typeof e.message === 'string' && e.message.length > 0, 'message must be non-empty text');
    }
  });
});

// ── deriveDriver — Q-factor derivation ───────────────────────────────────────

describe('deriveDriver — Q-factor derivation branches', () => {
  it('derives Qts from Qes and Qms when Qts is absent — '
   + 'standard scenario where Qes and Qms are measured separately', () => {
    const { value: d } = deriveDriver({ ...BASE, Qes: QES, Qms: QMS });
    assert.ok(d);
    assert(
      Math.abs(d.Qts - QTS_DERIVED) < Q_TOL,
      `expected Qts = Qes·Qms/(Qes+Qms) = ${QTS_DERIVED}, got ${d.Qts}`,
    );
  });

  it('derives Qes from Qts and Qms when Qes is absent — '
   + 'inverse combination formula Qes = Qts·Qms / (Qms − Qts)', () => {
    const expectedQes = (QTS_DERIVED * QMS) / (QMS - QTS_DERIVED);
    const { value: d } = deriveDriver({ ...BASE, Qts: QTS_DERIVED, Qms: QMS });
    assert.ok(d);
    assert(
      Math.abs(d.Qes - expectedQes) < Q_TOL,
      `expected Qes = ${expectedQes}, got ${d.Qes}`,
    );
  });

  it('derives Qms from Qts and Qes when Qms is absent — '
   + 'inverse combination formula Qms = Qts·Qes / (Qes − Qts)', () => {
    const expectedQms = (QTS_DERIVED * QES) / (QES - QTS_DERIVED);
    const { value: d } = deriveDriver({ ...BASE, Qts: QTS_DERIVED, Qes: QES });
    assert.ok(d);
    assert(
      Math.abs(d.Qms - expectedQms) < Q_TOL,
      `expected Qms = ${expectedQms}, got ${d.Qms}`,
    );
  });
});

// ── parseWdr — never throws ───────────────────────────────────────────────────
// parseWdr is a pure parser. T/S completeness validation is deriveDriver's job.

describe('parseWdr — returns {value, errors}, never throws', () => {
  it('returns an object with value and errors properties', () => {
    const result = parseWdr(MINIMAL_WDR);
    assert.ok('value' in result, 'must have value property');
    assert.ok('errors' in result, 'must have errors property');
    assert.ok(Array.isArray(result.errors), 'errors must be an array');
  });

  it('returns value and empty errors for a complete WDR', () => {
    const { value, errors } = parseWdr(MINIMAL_WDR);
    assert.ok(value != null, 'value must not be null for a complete WDR');
    assert.deepEqual(errors, [], 'no parse errors for a complete WDR');
  });

  it('returns value (with whatever was parsed) even when Fs is missing — T/S completeness is deriveDriver\'s job', () => {
    const noFs = MINIMAL_WDR.replace(/Fs=37\n/, '');
    const { value } = parseWdr(noFs);
    assert.ok(value != null, 'parseWdr returns what it found, not null, even when Fs is absent');
    assert.equal(value.Fs, undefined, 'Fs must be undefined (absent from parse result)');
  });

  it('returns value even when Vas is missing — does not guard T/S completeness', () => {
    const noVas = MINIMAL_WDR.replace(/Vas=[\d.]+\n/, '');
    const { value } = parseWdr(noVas);
    assert.ok(value != null, 'parseWdr returns what it found even without Vas');
  });

  it('returns value even when only one Q parameter is present — T/S underdetermination is not parseWdr\'s concern', () => {
    const oneQ = MINIMAL_WDR
      .replace(/Qes=[\d.]+\n/, '')
      .replace(/Qms=[\d.]+\n/, '');
    const { value } = parseWdr(oneQ);
    assert.ok(value != null, 'parseWdr does not enforce Q completeness');
  });

  it('returns value even when Sd is missing — not parseWdr\'s validation concern', () => {
    const noSd = MINIMAL_WDR.replace(/Sd=[\d.]+\n/, '');
    const { value } = parseWdr(noSd);
    assert.ok(value != null, 'parseWdr does not guard Sd');
  });

  it('returns value even when Re is missing — not parseWdr\'s validation concern', () => {
    const noRe = MINIMAL_WDR.replace(/Re=[\d.]+\n/, '');
    const { value } = parseWdr(noRe);
    assert.ok(value != null, 'parseWdr does not guard Re');
  });
});

// ── parseWdr — YAML sidecar URL field override ────────────────────────────────

describe('parseWdr — YAML sidecar overrides URL fields', () => {
  it('sidecar sets datasheetUrl from the datasheet_url field', () => {
    const sidecar = 'datasheet_url: https://new.example.com/sheet.pdf\n';
    const { value: d } = parseWdr(MINIMAL_WDR, sidecar);
    assert.ok(d);
    assert.equal(d.datasheetUrl, 'https://new.example.com/sheet.pdf',
      'sidecar datasheet_url field must populate datasheetUrl');
  });

  it('sidecar sets vendor_page_url, source, frd_url, and zma_url — '
   + 'all five sidecar URL keys are mapped to their driver object fields', () => {
    const sidecar = [
      'datasheet_url: https://example.com/sheet.pdf',
      'vendor_page_url: https://example.com/buy',
      'source: https://example.com/source',
      'frd_url: https://example.com/frd.frd',
      'zma_url: https://example.com/imp.zma',
    ].join('\n');
    const { value: d } = parseWdr(MINIMAL_WDR, sidecar);
    assert.ok(d);
    assert.equal(d.datasheetUrl,  'https://example.com/sheet.pdf');
    assert.equal(d.vendorpageUrl, 'https://example.com/buy');
    assert.equal(d.sourceUrl,     'https://example.com/source');
    assert.equal(d.frdUrl,        'https://example.com/frd.frd');
    assert.equal(d.impedanceUrl,  'https://example.com/imp.zma');
  });
});

// ── _parseSimpleYaml (via sidecar) — YAML edge cases ─────────────────────────
// _parseSimpleYaml is a private function tested through the sidecar code path.

describe('_parseSimpleYaml (via parseWdr sidecar) — YAML parser edge cases', () => {
  it('parses a plain key: value pair — the common case', () => {
    const { value: d } = parseWdr(MINIMAL_WDR, 'vendor_page_url: https://example.com/buy\n');
    assert.ok(d);
    assert.equal(d.vendorpageUrl, 'https://example.com/buy');
  });

  it('treats null literal as absent — sidecar null means the field was intentionally cleared', () => {
    const { value: d } = parseWdr(MINIMAL_WDR, 'vendor_page_url: null\n');
    assert.ok(d);
    assert.equal(d.vendorpageUrl, undefined,
      'null sidecar value must not set vendorpageUrl');
  });

  it('treats an empty value as absent — bare key: with no value is treated like null', () => {
    const { value: d } = parseWdr(MINIMAL_WDR, 'vendor_page_url:\n');
    assert.ok(d);
    assert.equal(d.vendorpageUrl, undefined);
  });

  it('unescapes doubled single-quotes in YAML single-quoted strings — '
   + "YAML rule: '' inside '...' is a literal apostrophe", () => {
    const { value: d } = parseWdr(MINIMAL_WDR, "vendor_page_url: 'it''s here'\n");
    assert.ok(d);
    assert.equal(d.vendorpageUrl, "it's here");
  });

  it('ignores lines with no colon — blank lines and comment-style separators pass silently', () => {
    const sidecar = '\nvendor_page_url: https://example.com/buy\n\n';
    const { value: d } = parseWdr(MINIMAL_WDR, sidecar);
    assert.ok(d);
    assert.equal(d.vendorpageUrl, 'https://example.com/buy');
  });

  it('parses block scalar (|) with multiple indented continuation lines — '
   + 'multi-line description text is joined with newlines', () => {
    const sidecar = [
      'vendor_page_url: |',
      '  line one',
      '  line two',
      'source: https://example.com/src',
    ].join('\n');
    const { value: d } = parseWdr(MINIMAL_WDR, sidecar);
    assert.ok(d);
    assert.equal(d.vendorpageUrl, 'line one\nline two',
      'block scalar lines must be joined with \\n, indentation stripped');
    assert.equal(d.sourceUrl, 'https://example.com/src',
      'the key after the block scalar must still be parsed');
  });

  it('parses block scalar at end of file without a trailing key — '
   + 'end-of-input guard must flush the accumulated block lines', () => {
    const sidecar = [
      'vendor_page_url: |',
      '  only line',
    ].join('\n');
    const { value: d } = parseWdr(MINIMAL_WDR, sidecar);
    assert.ok(d);
    assert.equal(d.vendorpageUrl, 'only line',
      'end-of-file block scalar must be flushed correctly');
  });
});

// ── parseWdr — undefined-field cleanup ───────────────────────────────────────

describe('parseWdr — undefined fields are removed from the returned object', () => {
  it('drops optional fields absent from WDR rather than returning undefined — '
   + 'Le and Xmax are optional; missing ones must not appear in the driver object', () => {
    const noOptional = MINIMAL_WDR
      .replace(/Le=[\d.e+-]+\n/, '')
      .replace(/Xmax=[\d.]+\n/, '');
    const { value: d } = parseWdr(noOptional);
    assert.ok(d);
    assert.equal(d.Le, undefined, 'absent Le must not appear in driver object');
    assert.equal(d.Xmax, undefined, 'absent Xmax must not appear in driver object');
    assert.equal(d.Fs, 37);
  });
});

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
