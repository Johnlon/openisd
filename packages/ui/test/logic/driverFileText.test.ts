/**
 * `decodeDriverFileBytes` — the format gate on QO62's CP1252 fallback: a `.wdr`/`.wpr` may
 * legitimately be legacy Windows-codepage, but `.owdr`/`.owpr`/JSON (or an unrecognised
 * format) are OpenISD's own UTF-8 output, so a CP1252 result there must be reported as
 * corruption, not silently decoded. Takes the FORMAT directly, never a filename.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { decodeDriverFileBytes } from '../../src/logic/driverFileText.js';
import { WdrEncoding } from '@openisd/winisd';
import { DriverFileFormat, ProjectFileFormat } from '../../src/fileFormat.js';

describe('decodeDriverFileBytes format gate (QO62)', () => {
  it('a non-UTF-8 .wdr falls back to CP1252 and reports it', () => {
    const bytes = new Uint8Array([0x4b, 0x61, 0x70, 0x74, 0x6f, 0x6e, 0xae]); // "Kapton" + (R)
    const { text, encoding } = decodeDriverFileBytes(bytes, DriverFileFormat.Wdr);

    assert.equal(encoding, WdrEncoding.Cp1252);
    assert.equal(text, 'Kapton®');
  });

  it('a non-UTF-8 .wpr falls back to CP1252 and reports it', () => {
    const bytes = new Uint8Array([0x4b, 0x61, 0x70, 0x74, 0x6f, 0x6e, 0xae]);
    const { text, encoding } = decodeDriverFileBytes(bytes, ProjectFileFormat.Wpr);

    assert.equal(encoding, WdrEncoding.Cp1252);
    assert.equal(text, 'Kapton®');
  });

  it('a non-UTF-8 .owdr throws rather than silently decoding as CP1252', () => {
    const bytes = new Uint8Array([0x4b, 0x61, 0x70, 0x74, 0x6f, 0x6e, 0xae]);
    assert.throws(() => decodeDriverFileBytes(bytes, DriverFileFormat.Owdr),
      /not valid UTF-8/i);
  });

  it('a non-UTF-8 .owpr throws rather than silently decoding as CP1252', () => {
    const bytes = new Uint8Array([0x4b, 0x61, 0x70, 0x74, 0x6f, 0x6e, 0xae]);
    assert.throws(() => decodeDriverFileBytes(bytes, ProjectFileFormat.Owpr),
      /not valid UTF-8/i);
  });

  it('a non-UTF-8 file with no known format throws rather than silently decoding as CP1252', () => {
    const bytes = new Uint8Array([0x7b, 0x22, 0x61, 0x22, 0x3a, 0xae]); // `{"a":` + 0xAE
    assert.throws(() => decodeDriverFileBytes(bytes, undefined),
      /not valid UTF-8/i);
  });

  it('a valid-UTF-8 .owdr decodes normally and is never gated', () => {
    const bytes = new TextEncoder().encode('{"a":1}');
    const { text, encoding } = decodeDriverFileBytes(bytes, DriverFileFormat.Owdr);

    assert.equal(encoding, WdrEncoding.Utf8);
    assert.equal(text, '{"a":1}');
  });

  it('the legacy-format gate agrees with DriverFileFormat.ALL on every member: only .wdr falls back', () => {
    // decodeDriverFileBytes' gate is `fileFormat.ts`'s isLegacyWinisdFormat — the ONE
    // classifier both DriverFileFormat and ProjectFileFormat are built from (QO67), so this
    // loop and the ProjectFileFormat.Wpr case below exercise the SAME source, not two
    // independently-implemented checks agreeing by coincidence.
    const bytes = new Uint8Array([0x4b, 0x61, 0x70, 0x74, 0x6f, 0x6e, 0xae]); // "Kapton" + (R), not valid UTF-8

    for (const format of DriverFileFormat.ALL) {
      if (format === DriverFileFormat.Wdr) {
        const { encoding } = decodeDriverFileBytes(bytes, format);
        assert.equal(encoding, WdrEncoding.Cp1252, `${format.value}: expected the CP1252 fallback`);
      } else {
        assert.throws(() => decodeDriverFileBytes(bytes, format), /not valid UTF-8/i,
          `${format.value}: expected a non-legacy format to reject non-UTF-8 bytes`);
      }
    }
  });

  it('the legacy-format gate also falls back for .wpr (a PROJECT format, not a DriverFileFormat member)', () => {
    const bytes = new Uint8Array([0x4b, 0x61, 0x70, 0x74, 0x6f, 0x6e, 0xae]);
    const { encoding } = decodeDriverFileBytes(bytes, ProjectFileFormat.Wpr);
    assert.equal(encoding, WdrEncoding.Cp1252);
  });

  it('the legacy-format gate does NOT fall back for .owpr — the project format that is NOT classic WinISD', () => {
    const bytes = new Uint8Array([0x4b, 0x61, 0x70, 0x74, 0x6f, 0x6e, 0xae]);
    assert.throws(() => decodeDriverFileBytes(bytes, ProjectFileFormat.Owpr), /not valid UTF-8/i);
  });

  it('an absent format (extension not recognised) is treated as non-legacy and throws', () => {
    const bytes = new Uint8Array([0x4b, 0x61, 0x70, 0x74, 0x6f, 0x6e, 0xae]);
    assert.throws(() => decodeDriverFileBytes(bytes, undefined), /not valid UTF-8/i);
  });
});
