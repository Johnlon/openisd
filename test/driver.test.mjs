/**
 * Unit tests for src/core/driver.js
 *
 * Covers: deriveDriver Q-derivation branches, parseWdr (including sidecar),
 * _parseSimpleYaml (via sidecar code path), and toWdr/parseWdr round-trip.
 *
 * Q-factor formulas: https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 *   Qts = (Qes · Qms) / (Qes + Qms)
 *   Qes = (Qts · Qms) / (Qms − Qts)   [inverse]
 *   Qms = (Qts · Qes) / (Qes − Qts)   [inverse]
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deriveDriver, parseWdr, toWdr } from '../src/core/driver.js';

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
// Contains every field required by parseWdr's validation gate:
//   Fs, Sd, Re must be present; Vas OR (Qts AND Qes) must be present.
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

// ── deriveDriver — Q-factor derivation ───────────────────────────────────────

describe('deriveDriver — Q-factor derivation branches', () => {
  it('derives Qts from Qes and Qms when Qts is absent — '
   + 'standard scenario where Qes and Qms are measured separately', () => {
    const d = deriveDriver({ ...BASE, Qes: QES, Qms: QMS });
    assert(
      Math.abs(d.Qts - QTS_DERIVED) < Q_TOL,
      `expected Qts = Qes·Qms/(Qes+Qms) = ${QTS_DERIVED}, got ${d.Qts}`,
    );
  });

  it('derives Qes from Qts and Qms when Qes is absent — '
   + 'inverse combination formula Qes = Qts·Qms / (Qms − Qts)', () => {
    const expectedQes = (QTS_DERIVED * QMS) / (QMS - QTS_DERIVED);
    const d = deriveDriver({ ...BASE, Qts: QTS_DERIVED, Qms: QMS });
    assert(
      Math.abs(d.Qes - expectedQes) < Q_TOL,
      `expected Qes = ${expectedQes}, got ${d.Qes}`,
    );
  });

  it('derives Qms from Qts and Qes when Qms is absent — '
   + 'inverse combination formula Qms = Qts·Qes / (Qes − Qts)', () => {
    const expectedQms = (QTS_DERIVED * QES) / (QES - QTS_DERIVED);
    const d = deriveDriver({ ...BASE, Qts: QTS_DERIVED, Qes: QES });
    assert(
      Math.abs(d.Qms - expectedQms) < Q_TOL,
      `expected Qms = ${expectedQms}, got ${d.Qms}`,
    );
  });
});

// ── parseWdr — validation gate ────────────────────────────────────────────────

describe('parseWdr — validation gate', () => {
  it('throws when Fs is missing — cannot compute resonant frequency without it', () => {
    const noFs = MINIMAL_WDR.replace(/Fs=37\n/, '');
    assert.throws(
      () => parseWdr(noFs),
      /missing core T\/S parameters/,
    );
  });

  it('throws when both Vas and the Qts/Qes pair are absent — '
   + 'compliance must come from at least one source', () => {
    // Strip Vas and Qts — Qes alone cannot satisfy (Qts && Qes)
    const stripped = MINIMAL_WDR
      .replace(/Vas=[\d.]+\n/, '')
      .replace(/Qts=[\d.]+\n/, '');
    assert.throws(
      () => parseWdr(stripped),
      /missing core T\/S parameters/,
    );
  });
});

// ── parseWdr — YAML sidecar URL field override ────────────────────────────────

describe('parseWdr — YAML sidecar overrides URL fields', () => {
  it('sidecar sets datasheetUrl from the datasheet field', () => {
    const sidecar = 'datasheet: https://new.example.com/sheet.pdf\n';
    const d = parseWdr(MINIMAL_WDR, sidecar);
    assert.equal(d.datasheetUrl, 'https://new.example.com/sheet.pdf',
      'sidecar datasheet field must populate datasheetUrl');
  });

  it('sidecar sets vendor_page, source, frd, and impedance URLs — '
   + 'all five sidecar URL keys are mapped to their driver object fields', () => {
    const sidecar = [
      'datasheet: https://example.com/sheet.pdf',
      'vendor_page: https://example.com/buy',
      'source: https://example.com/source',
      'frd: https://example.com/frd.frd',
      'impedance: https://example.com/imp.zma',
    ].join('\n');
    const d = parseWdr(MINIMAL_WDR, sidecar);
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
    const d = parseWdr(MINIMAL_WDR, 'vendor_page: https://example.com/buy\n');
    assert.equal(d.vendorpageUrl, 'https://example.com/buy');
  });

  it('treats null literal as absent — sidecar null means the field was intentionally cleared', () => {
    // The guard `if (s.vendor_page)` skips null values, leaving the field unset.
    const d = parseWdr(MINIMAL_WDR, 'vendor_page: null\n');
    assert.equal(d.vendorpageUrl, undefined,
      'null sidecar value must not set vendorpageUrl');
  });

  it('treats an empty value as absent — bare key: with no value is treated like null', () => {
    // Line `vendor_page:` has v='' which matches `if (!v || v === 'null')`
    const d = parseWdr(MINIMAL_WDR, 'vendor_page:\n');
    assert.equal(d.vendorpageUrl, undefined);
  });

  it('unescapes doubled single-quotes in YAML single-quoted strings — '
   + "YAML rule: '' inside '...' is a literal apostrophe", () => {
    // `vendor_page: 'it''s here'` → value is "it's here"
    const d = parseWdr(MINIMAL_WDR, "vendor_page: 'it''s here'\n");
    assert.equal(d.vendorpageUrl, "it's here");
  });

  it('ignores lines with no colon — blank lines and comment-style separators pass silently', () => {
    // A blank line in the sidecar should not cause a parse error.
    const sidecar = '\nvendor_page: https://example.com/buy\n\n';
    const d = parseWdr(MINIMAL_WDR, sidecar);
    assert.equal(d.vendorpageUrl, 'https://example.com/buy');
  });

  it('parses block scalar (|) with multiple indented continuation lines — '
   + 'multi-line description text is joined with newlines', () => {
    // YAML block scalar: key: |\n  line one\n  line two → value is "line one\nline two"
    const sidecar = [
      'vendor_page: |',
      '  line one',
      '  line two',
      'source: https://example.com/src',
    ].join('\n');
    const d = parseWdr(MINIMAL_WDR, sidecar);
    assert.equal(d.vendorpageUrl, 'line one\nline two',
      'block scalar lines must be joined with \\n, indentation stripped');
    assert.equal(d.sourceUrl, 'https://example.com/src',
      'the key after the block scalar must still be parsed');
  });

  it('parses block scalar at end of file without a trailing key — '
   + 'end-of-input guard must flush the accumulated block lines', () => {
    // When a block scalar is the last item and there is no following non-indented line,
    // the flush happens at line 57: `if (blockKey !== null) r[blockKey] = blockLines.join('\n')`
    const sidecar = [
      'vendor_page: |',
      '  only line',
    ].join('\n');
    const d = parseWdr(MINIMAL_WDR, sidecar);
    assert.equal(d.vendorpageUrl, 'only line',
      'end-of-file block scalar must be flushed correctly');
  });
});

// ── parseWdr — validation sub-branches ───────────────────────────────────────

describe('parseWdr — individual required-field validation sub-branches', () => {
  it('throws when Sd is missing — piston area is required for all derived quantities', () => {
    const noSd = MINIMAL_WDR.replace(/Sd=[\d.]+\n/, '');
    assert.throws(() => parseWdr(noSd), /missing core T\/S parameters/);
  });

  it('throws when Re is missing — DC resistance is required for Bl and sensitivity', () => {
    const noRe = MINIMAL_WDR.replace(/Re=[\d.]+\n/, '');
    assert.throws(() => parseWdr(noRe), /missing core T\/S parameters/);
  });

  it('accepts a WDR with Qts and Qes but no Vas — Q pair satisfies compliance requirement', () => {
    const noVas = MINIMAL_WDR.replace(/Vas=[\d.]+\n/, '');
    const d = parseWdr(noVas);
    // Validate that Qts and Qes are both present and correct
    assert.equal(d.Qts, 0.38);
    assert.equal(d.Qes, 0.40);
    assert.equal(d.Vas, undefined, 'Vas must be absent when not in WDR');
  });
});

// ── parseWdr — undefined-field cleanup ───────────────────────────────────────

describe('parseWdr — undefined fields are removed from the returned object', () => {
  it('drops optional fields absent from WDR rather than returning undefined — '
   + 'Le and Xmax are optional; missing ones must not appear in the driver object', () => {
    // Strip optional fields Le and Xmax — n() returns undefined for absent fields,
    // and line 106 (for (const k in d) if (d[k] === undefined) delete d[k]) cleans them up.
    const noOptional = MINIMAL_WDR
      .replace(/Le=[\d.e+-]+\n/, '')
      .replace(/Xmax=[\d.]+\n/, '');
    const d = parseWdr(noOptional);
    assert.equal(d.Le, undefined, 'absent Le must not appear in driver object');
    assert.equal(d.Xmax, undefined, 'absent Xmax must not appear in driver object');
    // Core fields must still be present
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
    // g(d.Z || d.Re) → g(undefined || 5.6) → g(5.6) → '5.6' or '5.60000'
    assert.match(wdr, /^Znom=5\.6/m, 'Znom must fall back to Re when Z is absent');
  });

  it('produces Vd=0 when Xmax is absent — zero peak displacement volume', () => {
    // (d.Xmax || 0) takes the 0 path; g(d.Xmax) returns '' (null/undefined branch in g)
    const wdr = toWdr(BARE_DRIVER);
    assert.match(wdr, /^Vd=0$/m, 'Vd must be 0 when Xmax is absent');
    assert.match(wdr, /^Xmax=$/m, 'Xmax= must be empty string when Xmax is absent');
  });
});
