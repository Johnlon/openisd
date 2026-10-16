/**
 * F41: a route handler still inside `route.fetch()` when a browser test ends throws "Test ended"
 * into the result. The shared `browserLog` fixture must wait for in-flight handlers and drop the
 * routes after the test body, for every spec.
 */
import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures.ts');

describe('the browser fixture settles route handlers', () => {
  it('calls page.unrouteAll with ignoreErrors straight after the test body', () => {
    const text = readFileSync(FIXTURES, 'utf8');
    const afterBody = text.slice(text.indexOf('await use(log);'));
    expect(afterBody).toMatch(/^await use\(log\);\s*(\/\/[^\n]*\n\s*)*await page\.unrouteAll\(\{ behavior: 'ignoreErrors' \}\);/);
  });
});
