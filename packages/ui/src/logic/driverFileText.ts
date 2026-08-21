/**
 * Reading a driver or project file off disk.
 *
 * A `.wdr` is ENCODED BYTES, not text: a newline inside a string field is the single byte
 * `0xA4`, which is not valid UTF-8, so `FileReader.readAsText()` destroys it — the byte becomes
 * U+FFFD and the newline is unrecoverable before any parser sees it. Every file that can carry
 * a `[Driver]` block therefore comes in as bytes and goes through `wdrBytesToText`, which is
 * the only code that knows about the encoding.
 *
 * That includes `.wpr`: a project file embeds its `[Driver]` block verbatim, sentinels and all.
 * `wdrBytesToText` falls back to CP1252 (QO62) when a `.wdr`/`.wpr` is not valid UTF-8, because
 * classic WinISD is Windows-only and files already in circulation are legacy Windows-codepage
 * exports. `.owdr`, `.owpr` and plain JSON are OpenISD's OWN output, always UTF-8 — a CP1252
 * result there means the file is corrupt, not legacy, so `decodeDriverFileBytes` rejects it
 * rather than handing back a lossy re-decode.
 */
import { wdrBytesToText, WdrEncoding, wdrTextToBytes, type WdrDecodedText } from '@openisd/winisd';

/** `.wdr`/`.wpr` are the only formats classic (Windows-only) WinISD itself could have written,
 *  and so the only ones the CP1252 fallback (QO62) applies to. */
function isLegacyWinisdFormat(fileName: string): boolean {
  return /\.(wdr|wpr)$/i.test(fileName);
}

/** `bytes` (a file named `fileName`) decoded to text, gated by format: a `.wdr`/`.wpr` may
 *  legitimately fall back to CP1252 (QO62); any other format is OpenISD's own UTF-8 output, so
 *  a CP1252 result there is corruption and throws rather than silently losing data. */
export function decodeDriverFileBytes(bytes: Uint8Array, fileName: string): WdrDecodedText {
  const decoded = wdrBytesToText(bytes);
  if (decoded.encoding === WdrEncoding.Cp1252 && !isLegacyWinisdFormat(fileName)) {
    throw new Error(`${fileName} is not valid UTF-8 — OpenISD's own file formats are always UTF-8`);
  }
  return decoded;
}

/** One file's text, with the `.wdr` byte encoding already resolved, and which encoding
 *  (`WdrEncoding.Utf8` or `WdrEncoding.Cp1252`, QO62) produced it. Rejects if the read fails,
 *  or if a non-legacy format decodes as anything but UTF-8 (see `decodeDriverFileBytes`). An
 *  empty file resolves to an empty string, which the caller decides what to do about. */
export function readDriverFileText(file: File): Promise<WdrDecodedText> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`could not read ${file.name}`));
    reader.onload = () => {
      try {
        resolve(decodeDriverFileBytes(new Uint8Array(reader.result as ArrayBuffer), file.name));
      } catch (err) {
        reject(err as Error);
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

/** A driver file's BODY, ready to write. `.wdr` carries its own encoding, so it goes out as
 *  bytes; `.owdr` is JSON and goes out as text. The UI hands over text and a format and never
 *  learns which of the two it got. */
export function driverFileBody(text: string, isWdr: boolean): string | Uint8Array<ArrayBuffer> {
  return isWdr ? wdrTextToBytes(text) : text;
}
