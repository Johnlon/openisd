/**
 * `decodeDriverFileBytes` — the format gate on QO62's CP1252 fallback: a `.wdr`/`.wpr` may
 * legitimately be legacy Windows-codepage, but `.owdr`/`.owpr`/JSON are OpenISD's own UTF-8
 * output, so a CP1252 result there must be reported as corruption, not silently decoded.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { decodeDriverFileBytes } from '../../src/logic/driverFileText.js';
import { WdrEncoding } from '@openisd/winisd';
import { DriverFileFormat } from '../../src/driverFileFormat.js';

describe('decodeDriverFileBytes format gate (QO62)', () => {
  it('a non-UTF-8 .wdr falls back to CP1252 and reports it', () => {
    const bytes = new Uint8Array([0x4b, 0x61, 0x70, 0x74, 0x6f, 0x6e, 0xae]); // "Kapton" + (R)
    const { text, encoding } = decodeDriverFileBytes(bytes, 'Selenium SW108 .wdr');

    assert.equal(encoding, WdrEncoding.Cp1252);
    assert.equal(text, 'Kapton®');
  });

  it('a non-UTF-8 .wpr falls back to CP1252 and reports it', () => {
    const bytes = new Uint8Array([0x4b, 0x61, 0x70, 0x74, 0x6f, 0x6e, 0xae]);
    const { text, encoding } = decodeDriverFileBytes(bytes, 'project.wpr');

    assert.equal(encoding, WdrEncoding.Cp1252);
    assert.equal(text, 'Kapton®');
  });

  it('a non-UTF-8 .owdr throws rather than silently decoding as CP1252', () => {
    const bytes = new Uint8Array([0x4b, 0x61, 0x70, 0x74, 0x6f, 0x6e, 0xae]);
    assert.throws(() => decodeDriverFileBytes(bytes, 'my-driver.owdr'),
      /not valid UTF-8/);
  });

  it('a non-UTF-8 .owpr throws rather than silently decoding as CP1252', () => {
    const bytes = new Uint8Array([0x4b, 0x61, 0x70, 0x74, 0x6f, 0x6e, 0xae]);
    assert.throws(() => decodeDriverFileBytes(bytes, 'my-project.owpr'),
      /not valid UTF-8/);
  });

  it('a non-UTF-8 .json throws rather than silently decoding as CP1252', () => {
    const bytes = new Uint8Array([0x7b, 0x22, 0x61, 0x22, 0x3a, 0xae]); // `{"a":` + 0xAE
    assert.throws(() => decodeDriverFileBytes(bytes, 'driver.json'),
      /not valid UTF-8/);
  });

  it('a valid-UTF-8 .owdr decodes normally and is never gated', () => {
    const bytes = new TextEncoder().encode('{"a":1}');
    const { text, encoding } = decodeDriverFileBytes(bytes, 'driver.owdr');

    assert.equal(encoding, WdrEncoding.Utf8);
    assert.equal(text, '{"a":1}');
  });

  it('the legacy-format gate agrees with DriverFileFormat.ALL on every member: only .wdr falls back', () => {
    // isLegacyWinisdFormat stays private, so this asserts through decodeDriverFileBytes'
    // observable behaviour per format member rather than reaching into the module internals.
    const bytes = new Uint8Array([0x4b, 0x61, 0x70, 0x74, 0x6f, 0x6e, 0xae]); // "Kapton" + (R), not valid UTF-8

    for (const format of DriverFileFormat.ALL) {
      const fileName = `x.${format.value}`;
      if (format === DriverFileFormat.Wdr) {
        const { encoding } = decodeDriverFileBytes(bytes, fileName);
        assert.equal(encoding, WdrEncoding.Cp1252, `${fileName}: expected the CP1252 fallback`);
      } else {
        assert.throws(() => decodeDriverFileBytes(bytes, fileName), /not valid UTF-8/,
          `${fileName}: expected a non-legacy format to reject non-UTF-8 bytes`);
      }
    }
  });
});
