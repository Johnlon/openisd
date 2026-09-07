/**
 * `parseIni`/`stringifyIni` — the generic INI reader/writer WinISD's own `.wdr`/`.wpr` files
 * need. Not `npm/ini`: that library strips everything after an unquoted `;` or `#` inside a
 * value, but real WinISD does not treat those characters as comment markers in a value — only a
 * WHOLE LINE starting with `;` or `#` is a comment, and WinISD itself never writes one (there is
 * no comment-bearing file in the golden corpus), so this reader drops a standalone comment line
 * without trying to preserve it.
 *
 * Shape: section name → key → value, a plain object at both levels (JS/TS guarantees
 * string-keyed insertion order, so nothing needs an explicit ordering array) — directly usable
 * by a Zod schema or `JSON.stringify`, matching `npm/ini`'s own return shape.
 *
 * Byte precision is the bar: parsing a real WinISD-written file and stringifying it back
 * unchanged must reproduce the file exactly, key order and section order included.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseIni, stringifyIni } from '@openisd/design/ini';

const here = dirname(fileURLToPath(import.meta.url));
const GOLDENS_DIR = join(here, '..', 'winisd', 'fixtures', 'winisd-parity', 'goldens');
const MATT_DRIVERS_DIR = join(here, '..', '..', '..', '..', 'drivers', 'matt');
const SAMPLE_WINISD_DIR = join(here, '..', '..', '..', '..', 'drivers', 'sample', 'winisd');
const SEMICOLONS_AND_HASH = join(SAMPLE_WINISD_DIR, 'driver-with-semicolons-and-hash.wdr');

describe('parseIni — section and key order', () => {
  it('keeps sections in file order', () => {
    const parsed = parseIni('[B]\nx=1\n\n[A]\ny=2\n');
    assert.deepEqual(Object.keys(parsed), ['B', 'A']);
  });

  it('keeps keys in file order within a section', () => {
    const parsed = parseIni('[Box]\nz=1\na=2\nm=3\n');
    assert.deepEqual(Object.keys(parsed.Box), ['z', 'a', 'm']);
  });

  it('reads a value verbatim, including a semicolon or hash WinISD does not treat as a comment marker', () => {
    const parsed = parseIni('Comment=Sourced from datasheet; verified 2026 #ok\n');
    assert.equal(parsed[''].Comment, 'Sourced from datasheet; verified 2026 #ok');
  });

  it('drops a whole-line comment starting with ; or #, matching WinISD (which never writes one)', () => {
    const parsed = parseIni('; a comment\n[Box]\n# another\nx=1\n');
    assert.deepEqual(parsed, { Box: { x: '1' } });
  });

  it('keeps an empty section as a section with zero keys, not absent', () => {
    const parsed = parseIni('[ProjectInfo]\nDescription=hi\n\n[PassiveRadiator]\n\n[Box]\nBType=0\n');
    assert.deepEqual(parsed, { ProjectInfo: { Description: 'hi' }, PassiveRadiator: {}, Box: { BType: '0' } });
  });

  it('lines before any [Section] header are section-less, name ""', () => {
    const parsed = parseIni('scope=global\n[Box]\nx=1\n');
    assert.deepEqual(parsed[''], { scope: 'global' });
  });
});

describe('stringifyIni — round trip of what parseIni produced', () => {
  it('renders sections in the given order, each as [Name] then its entries', () => {
    const text = stringifyIni({ B: { x: '1' }, A: { y: '2' } });
    assert.equal(text, '[B]\r\nx=1\r\n\r\n[A]\r\ny=2\r\n');
  });

  it('renders a zero-key section as a bare header line — the shape npm/ini cannot produce', () => {
    const text = stringifyIni({ PassiveRadiator: {} });
    assert.equal(text, '[PassiveRadiator]\r\n');
  });

  it('never re-comments a value containing ; or #', () => {
    const text = stringifyIni({ Driver: { Comment: 'a; b #c' } });
    assert.equal(text, '[Driver]\r\nComment=a; b #c\r\n');
  });
});

describe('byte precision on real WinISD-written .wpr goldens', () => {
  const files = readdirSync(GOLDENS_DIR).filter((f) => f.endsWith('.wpr'));
  assert.ok(files.length > 0, 'expected at least one .wpr golden fixture to exist');

  for (const file of files) {
    it(`${file}: parse then stringify reproduces the file byte-for-byte`, () => {
      const original = readFileSync(join(GOLDENS_DIR, file), 'utf8');
      const roundTripped = stringifyIni(parseIni(original));
      assert.equal(roundTripped, original);
    });
  }
});

describe('byte precision on the real .wdr driver corpus (drivers/matt)', () => {
  const files = readdirSync(MATT_DRIVERS_DIR).filter((f) => f.endsWith('.wdr'));
  assert.ok(files.length > 0, 'expected at least one real .wdr file to exist in drivers/matt');

  for (const file of files) {
    it(`${file}: parse then stringify reproduces the file byte-for-byte`, () => {
      const original = readFileSync(join(MATT_DRIVERS_DIR, file), 'utf8');
      const roundTripped = stringifyIni(parseIni(original));
      assert.equal(roundTripped, original);
    });
  }
});

describe('byte precision on the GetPrivateProfileString empirical proof fixture', () => {
  it('driver-with-semicolons-and-hash.wdr round-trips exactly — inline ; and # are never comments', () => {
    const original = readFileSync(SEMICOLONS_AND_HASH, 'utf8');
    const roundTripped = stringifyIni(parseIni(original));
    assert.equal(roundTripped, original);
  });
});
