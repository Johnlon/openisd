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
 * For a file with no sentinel — `.owdr`, `.owpr`, plain JSON — the decode is the identity, so
 * one path serves every format and no caller has to know which it is holding.
 */
import { wdrBytesToText, wdrTextToBytes } from '@openisd/winisd';

/** One file's text, with the `.wdr` byte encoding already resolved. Rejects if the read fails;
 *  an empty file resolves to an empty string, which the caller decides what to do about. */
export function readDriverFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`could not read ${file.name}`));
    reader.onload = () => resolve(wdrBytesToText(new Uint8Array(reader.result as ArrayBuffer)));
    reader.readAsArrayBuffer(file);
  });
}

/** A driver file's BODY, ready to write. `.wdr` carries its own encoding, so it goes out as
 *  bytes; `.owdr` is JSON and goes out as text. The UI hands over text and a format and never
 *  learns which of the two it got. */
export function driverFileBody(text: string, isWdr: boolean): string | Uint8Array<ArrayBuffer> {
  return isWdr ? wdrTextToBytes(text) : text;
}
