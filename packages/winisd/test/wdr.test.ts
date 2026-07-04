/**
 * Unit tests for @openisd/winisd — WDR interop.
 *
 * Covers: parseWdr (including sidecar), _parseSimpleYaml (via sidecar),
 * toWdr fallback branches, and parstate E/C/N provenance.
 *
 * deriveDriver (pure physics) is imported from @openisd/engine — parstate consumes its
 * output to distinguish entered (E) from computed (C) fields.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { deriveDriver } from '@openisd/engine';
import { parseWdr, toWdr, parstate } from '@openisd/winisd';

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
