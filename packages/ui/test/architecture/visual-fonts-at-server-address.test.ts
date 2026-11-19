/**
 * T900: the developer protocol the font check reads the page through fetches the page's stylesheets again from the page's own
 * address, outside what a route can answer. At https://openisd.app/ that asks the live site, which has no file of the test build's
 * hashes and answers 404 (183 failures on main, 18 Nov 2026). The font check therefore opens each screen at the test server's address.
 */
import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const SPEC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'visual', 'visual-fonts.browser.spec.ts'), 'utf8').replace(/\/\/[^\n]*/g, '');

describe('the font check opens its screens at the test server', () => {
  it('uses openOnServer and never open', () => {
    expect(SPEC).toMatch(/screen\.openOnServer\(page\)/);
    expect(SPEC).not.toMatch(/screen\.open\(page\)/);
  });
});
