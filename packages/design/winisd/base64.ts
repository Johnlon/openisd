/**
 * Base64, for carrying a file's bytes across the V8 boundary.
 *
 * The bridge returns one JSON string, so a `.wdr`'s bytes cannot travel as themselves: a raw
 * `0xA4` is not valid UTF-8 and JSON has no byte type. They travel base64-encoded and the Python
 * caller writes what it decodes, without choosing a character encoding of its own.
 *
 * The embedded V8 has neither `btoa` nor `Buffer`, so the encoder is written out here.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** `bytes` as standard base64, padded with `=`. */
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const remaining = bytes.length - i;
    const b0 = bytes[i];
    const b1 = remaining > 1 ? bytes[i + 1] : 0;
    const b2 = remaining > 2 ? bytes[i + 2] : 0;
    out += ALPHABET[b0 >> 2];
    out += ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += remaining > 1 ? ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
    out += remaining > 2 ? ALPHABET[b2 & 0x3f] : '=';
  }
  return out;
}
