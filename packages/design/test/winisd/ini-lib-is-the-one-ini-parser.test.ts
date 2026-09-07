/**
 * `WinISDDriver` and `WinISDProject` read and write INI through `packages/design/ini`
 * (`parseIni`/`stringifyIni`) — they do not carry a second hand-rolled INI split/join.
 *
 * The two modules are the `.wdr`/`.wpr` in/out objects; the generic "section → key → value,
 * order preserved, whole-line `;`/`#` comment dropped, value never comment-split" behaviour is
 * `ini.ts`'s job and is proven byte-exact there against the golden corpus. A private
 * re-implementation of that split is the defect this guards: it drifts from `ini.ts` silently
 * (a value with an `=` in it, a bare `[Section]` header, CRLF vs LF) and there is then no one
 * parser the format's behaviour is pinned to.
 *
 * The byte-parity suites (`wdr-round-trip`, `winisdProjectParse`) stay the correctness net;
 * this test pins the STRUCTURE — that the net is over one parser, not two.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const DRIVER_SRC = join(here, '..', '..', 'winisd', 'winisdDriver.ts');
const PROJECT_SRC = join(here, '..', '..', 'winisd', 'winisdProject.ts');

describe('the ini module is the only INI parser these two files use', () => {
  it('winisdDriver.ts imports parseIni/stringifyIni from the ini module', () => {
    const src = readFileSync(DRIVER_SRC, 'utf8');
    assert.match(
      src,
      /import\s*\{[^}]*\bparseIni\b[^}]*\bstringifyIni\b[^}]*\}\s*from\s*['"](\.\.\/ini\/index\.js|\.\.\/ini\/ini\.js|@openisd\/design\/ini)['"]/,
      'winisdDriver.ts must import parseIni and stringifyIni from packages/design/ini',
    );
  });

  it('winisdProject.ts imports parseIni/stringifyIni from the ini module', () => {
    const src = readFileSync(PROJECT_SRC, 'utf8');
    assert.match(
      src,
      /import\s*\{[^}]*\bparseIni\b[^}]*\bstringifyIni\b[^}]*\}\s*from\s*['"](\.\.\/ini\/index\.js|\.\.\/ini\/ini\.js|@openisd\/design\/ini)['"]/,
      'winisdProject.ts must import parseIni and stringifyIni from packages/design/ini',
    );
  });

  it('neither file still hand-rolls key=value extraction into a section map', () => {
    for (const [name, path] of [['winisdDriver.ts', DRIVER_SRC], ['winisdProject.ts', PROJECT_SRC]] as const) {
      const src = readFileSync(path, 'utf8');
      // The tell of a private INI reader is splitting a value off a raw line by the `=` — an
      // `indexOf('=')` / `split('=')` on a per-line string, then a `.slice` around it. Iterating
      // lines to cut out the verbatim `[Driver]` block is not that: it never parses a value.
      const extractsKeyValue =
        /\bconst\s+\w+\s*=\s*\w*\.?indexOf\(\s*['"]=['"]\s*\)/.test(src) ||
        /\.split\(\s*['"]=['"]\s*\)/.test(src) ||
        /line\.slice\(\s*\w+\s*\+\s*1\s*\)/.test(src);
      assert.ok(
        !extractsKeyValue,
        `${name} still splits a value off a raw line by "=" — that is a second INI parser; route the key/value read through parseIni`,
      );
    }
  });
});
