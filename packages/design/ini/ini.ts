/**
 * A generic INI reader/writer for WinISD's `.wdr`/`.wpr` files — standing in for the Win32
 * `GetPrivateProfileString`/`WritePrivateProfileString` API that classic WinISD itself calls to
 * read and write these files, so this module follows that API's dialect rather than a generic
 * INI convention.
 *
 * Not `npm/ini`: that library strips everything after an unquoted `;` or `#` INSIDE a value, but
 * `GetPrivateProfileString`'s dialect only treats `;`/`#` as a comment marker when it is the
 * FIRST character of a whole line — never inside a value. Proven empirically: JL wrote and loaded
 * `drivers/sample/winisd/driver-with-semicolons-and-hash.wdr` — every header field's value
 * contains `hello;there#again` or a `Comment=` body with inline `;` and `#` throughout — and real
 * WinISD (confirmed by loading the file back) leaves every character untouched. WinISD itself
 * never writes a whole-line comment, so this reader drops a standalone comment line rather than
 * preserving it.
 *
 * Byte precision is the point: `stringifyIni(parseIni(text))` reproduces a real WinISD-written
 * file exactly — section order, key order, and every value's exact characters.
 *
 * Shape: a plain nested object, `{ SectionName: { key: value } }` — matching `npm/ini`'s own
 * return shape so it drops straight into a Zod schema (`z.record`/`z.object` with `.coerce` per
 * field) or `JSON.stringify` with no reduce step first. Order survives for free: the JS/TS spec
 * guarantees string-keyed object properties iterate in insertion order, so no separate ordering
 * mechanism is needed at either the section or the key level. An empty section is `{}` — a real,
 * distinct value (the bare `[PassiveRadiator]` header WinISD itself writes), never collapsed to
 * absent.
 */

/** One parsed INI file: section name → key → value, in file order at both levels. */
export type Ini = Record<string, Record<string, string>>;

/** Whether `trimmed` is a whole-line comment. Only a LINE whose first character is `;` or `#` is
 *  a comment — a `;`/`#` inside a value is ordinary text, never checked here. */
function isCommentLine(trimmed: string): boolean {
  return trimmed.startsWith(';') || trimmed.startsWith('#');
}

/**
 * Parse INI text into section → key → value. Lines before any `[Section]` header belong to a
 * section named `''`. A blank line or whole-line comment is skipped; every other line is read as
 * `key=value`, split on the FIRST `=` so a value itself containing `=` survives. A line with no
 * `=` is not a WinISD `.wdr`/`.wpr` shape and is skipped rather than guessed at.
 */
export function parseIni(text: string): Ini {
  const sections: Ini = {};
  let name = '';
  let current: Record<string, string> | null = null;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || isCommentLine(trimmed)) continue;

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      name = trimmed.slice(1, -1).trim();
      current = sections[name] = {};
      continue;
    }

    const i = line.indexOf('=');
    if (i < 0) continue;
    if (current === null) current = sections[name] = {}; // section-less entries, named ''.
    current[line.slice(0, i).trim()] = line.slice(i + 1);
  }

  return sections;
}

/**
 * Render section → key → value back to INI text, CRLF throughout — the line ending every
 * `.wdr`/`.wpr` file WinISD writes uses. A zero-key section renders as its bare header alone, the
 * one shape `npm/ini`'s `stringify` cannot produce (it drops an empty section entirely).
 */
export function stringifyIni(sections: Ini): string {
  const blocks: string[] = [];
  for (const [name, entries] of Object.entries(sections)) {
    const lines: string[] = name === '' ? [] : [`[${name}]`];
    for (const [key, value] of Object.entries(entries)) lines.push(`${key}=${value}`);
    blocks.push(lines.join('\r\n'));
  }
  return blocks.join('\r\n\r\n') + '\r\n';
}
