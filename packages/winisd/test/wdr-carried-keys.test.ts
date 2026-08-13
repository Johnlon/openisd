/**
 * @openisd/winisd — the carried (non-simulated) fields must use the keys WinISD writes.
 *
 * A field the editor exposes is only round-trippable if the writer puts it on the line
 * WinISD reads. Writing it under any other key loses it twice over: WinISD ignores the
 * line, and WinISD's own line for that quantity is echoed back unchanged, so the value in
 * the file contradicts the value in the editor.
 *
 * 🔒 ORACLE. Both the key set and the app-field↔key pairing come from
 * `drivers/sample/winisd/` — files WinISD itself wrote. The pairing is fixed by the
 * single-parameter probes (`s-*.wdr`, one field set per file, one new `E` in ParState),
 * catalogued in `drivers/sample/README.md`.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Driver } from '@openisd/winisd';
import { toWdr } from '../src/classic/wdr.js';
import type { DriverRaw } from '@openisd/engine';

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLES = join(here, '..', '..', '..', 'drivers', 'sample', 'winisd');

const WINISD_KEYS: ReadonlySet<string> = new Set(
  readFileSync(join(SAMPLES, 'john-all-defaults.wdr'), 'utf8')
    .split(/\r?\n/)
    .map(l => l.slice(0, l.indexOf('=')).trim())
    .filter(k => k.length > 0),
);

function fields(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i < 0 || line[0] === '[') continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

/**
 * app field → the `.wdr` key WinISD writes for it, with a probe value chosen so no two
 * fields can be confused if the writer crosses them.
 */
const CARRIED: ReadonlyArray<readonly [string, string, number]> = [
  // Thermal / motor — WinISD's editor labels are AlfaVC, R(t), C(t), Gloss, KLe.
  ['tc',                 'alfaVC',   0.0039],
  ['Rth',                'Rt',       1.1],
  ['Cth',                'Ct',       2.2],
  ['loss',               'Gloss',    3.3],
  ['Le2',                'KLe',      4.4],
  // Voice coil / gap heights.
  ['Hc',                 'Hc',       0.0055],
  ['Hg',                 'Hg',       0.0066],
  // Dimensions (stored SI; WinISD stores SI too, so the value crosses unchanged).
  ['thick',              'Thick',    0.0077],
  ['depth',              'Depth',    0.0088],
  ['magnetDepth',        'MagDepth', 0.0099],
  ['magnet',             'Magnet',   0.0111],
  ['basket',             'Basket',   0.0122],
  ['outer',              'Outer',    0.0133],
  ['VCd',                'Vcd',      0.0144],
  ['basketDisplacement', 'DVol',     0.000155],
];

describe('carried fields use the keys WinISD writes — loaded-file path (Driver.toWdr)', () => {
  const original = readFileSync(join(SAMPLES, 'John-all-manu-populated.wdr'), 'utf8');

  it('every carried key the writer emits is one WinISD writes', () => {
    const d = Driver.fromWdr(original);
    for (const [field, , probe] of CARRIED) d.enter(field, probe);
    for (const key of Object.keys(fields(d.toWdr()))) {
      assert.ok(WINISD_KEYS.has(key),
        `${key}= is not a key WinISD writes — a value put there never reaches WinISD`);
    }
  });

  for (const [field, wdrKey, probe] of CARRIED) {
    it(`${field} is written to ${wdrKey}= and survives re-import`, () => {
      const d = Driver.fromWdr(original);
      d.enter(field, probe);
      const out = fields(d.toWdr());
      assert.ok(wdrKey in out, `export must carry a ${wdrKey}= line`);
      assert.equal(parseFloat(out[wdrKey]), probe,
        `${wdrKey}= must hold the edited ${field} value, not the file's original`);
      assert.equal(Driver.fromWdr(d.toWdr()).cell(field).value, probe,
        `${field} must come back on re-import`);
    });
  }
});

describe('carried fields use the keys WinISD writes — fresh-authored path (classic toWdr)', () => {
  // A minimal driver the engine can derive, plus every carried field.
  const base: DriverRaw = { Fs: 40, Re: 6, Sd: 0.0135, Vas: 0.03, Qts: 0.4, Qes: 0.45, brand: 'x', model: 'y' };

  it('emits no key WinISD does not write', () => {
    const raw = { ...base } as Record<string, number | string>;
    for (const [field, , probe] of CARRIED) raw[field] = probe;
    for (const key of Object.keys(fields(toWdr(raw as DriverRaw)))) {
      // Xlim is the one legitimate exception: WinISD holds it in ParState slot 10 and
      // writes no key for it (drivers/sample/winisd/s-xlim.wdr), so the value has nowhere
      // WinISD-conformant to go and this writer keeps its own line for openisd round-trips.
      if (key === 'Xlim') continue;
      assert.ok(WINISD_KEYS.has(key),
        `${key}= is not a key WinISD writes — a value put there never reaches WinISD`);
    }
  });

  for (const [field, wdrKey, probe] of CARRIED) {
    it(`${field} is exported as ${wdrKey}= and survives re-import`, () => {
      const raw = { ...base, [field]: probe } as DriverRaw;
      const out = fields(toWdr(raw));
      assert.ok(wdrKey in out, `export must carry a ${wdrKey}= line`);
      assert.equal(parseFloat(out[wdrKey]), probe, `${wdrKey}= must hold the ${field} value`);
      assert.equal(Driver.fromWdr(toWdr(raw)).cell(field).value, probe,
        `${field} must come back on re-import`);
    });
  }
});

describe('the writer emits full precision', () => {
  it('a 15-significant-figure modeled value survives export unchanged', () => {
    const original = readFileSync(join(SAMPLES, 'John-all-manu-populated.wdr'), 'utf8');
    const d = Driver.fromWdr(original);
    // Vas is entered (ParState slot 19 = E) at 15 s.f., so toWdr overlays it rather than
    // echoing the source line — the exact case 6-s.f. rounding used to destroy.
    assert.equal(d.cell('Vas').state, 'E', 'fixture must have Vas entered for this to test the overlay');
    assert.equal(parseFloat(fields(d.toWdr()).Vas), 0.141584099539285);
  });

  it('the fresh-authored writer keeps every digit of an entered value', () => {
    const raw: DriverRaw = { Fs: 40, Re: 6, Sd: 0.0135, Vas: 0.141584099539285, Qts: 0.4, Qes: 0.45 };
    assert.equal(parseFloat(fields(toWdr(raw)).Vas), 0.141584099539285);
  });
});
