/**
 * Reading a driver or project file off disk.
 *
 * A `.wdr` is ENCODED BYTES, not text: a newline inside a string field is the single byte
 * `0xA4`, which is not valid UTF-8, so `FileReader.readAsText()` destroys it — the byte becomes
 * U+FFFD and the newline is unrecoverable before any parser sees it. Every file that can carry
 * a `[Driver]` block therefore comes in as bytes and goes through `winisdBytesToText`, which is
 * the only code that knows about the encoding.
 *
 * That includes `.wpr`: a project file embeds its `[Driver]` block verbatim, sentinels and all.
 * `winisdBytesToText` falls back to CP1252 (QO62) when a `.wdr`/`.wpr` is not valid UTF-8, because
 * classic WinISD is Windows-only and files already in circulation are legacy Windows-codepage
 * exports. `.owdr`, `.owpr` and plain JSON are OpenISD's OWN output, always UTF-8 — a CP1252
 * result there means the file is corrupt, not legacy, so `decodeDriverFileBytes` rejects it
 * rather than handing back a lossy re-decode.
 */
import { winisdBytesToText, WinisdEncoding, winisdTextToBytes, type WinisdDecodedText } from '@openisd/winisd';
import { DriverFileFormat, ProjectFileFormat, isLegacyWinisdFormat, type FileFormat } from '../fileFormat.js';

/** `bytes` decoded to text, gated by `format`: `.wdr`/`.wpr` may legitimately fall back to
 *  CP1252 (QO62); every other format (or an unrecognised/absent one) is OpenISD's own UTF-8
 *  output, so a CP1252 result there is corruption and throws rather than silently losing data.
 *  Takes the format DIRECTLY — never a filename to reverse-engineer it from — so a caller that
 *  already knows the format (or has none to offer) never has to fabricate a filename just to
 *  route through this gate. */
export function decodeDriverFileBytes(bytes: Uint8Array, format: FileFormat | undefined): WinisdDecodedText {
  const decoded = winisdBytesToText(bytes);
  if (decoded.encoding === WinisdEncoding.Cp1252 && !isLegacyWinisdFormat(format)) {
    throw new Error('Not valid UTF-8 — OpenISD\'s own file formats are always UTF-8');
  }
  return decoded;
}

/** One file's text, with the `.wdr` byte encoding already resolved, and which encoding
 *  (`WinisdEncoding.Utf8` or `WinisdEncoding.Cp1252`, QO62) produced it. Rejects if the read fails,
 *  or if a non-legacy format decodes as anything but UTF-8 (see `decodeDriverFileBytes`). An
 *  empty file resolves to an empty string, which the caller decides what to do about. The
 *  format is classified from `file.name`'s extension alone — cheap and always available before
 *  the bytes are even read, unlike content-sniffing, which needs the decoded bytes this
 *  function is what produces. */
export function readDriverFileText(file: File): Promise<WinisdDecodedText> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`could not read ${file.name}`));
    reader.onload = () => {
      try {
        const format = DriverFileFormat.ofFileName(file.name) ?? ProjectFileFormat.ofFileName(file.name) ?? undefined;
        resolve(decodeDriverFileBytes(new Uint8Array(reader.result as ArrayBuffer), format));
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
  return isWdr ? winisdTextToBytes(text) : text;
}
