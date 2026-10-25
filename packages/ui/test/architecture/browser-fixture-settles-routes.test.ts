/**
 * F41: a route handler still inside `route.fetch()` when a browser test ends throws "Test ended"
 * into the result. The shared `page` fixture must wait for in-flight handlers and drop the
 * routes after the test body, before the page closes, for every spec.
 */
import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures.ts');

describe('the browser fixture settles route handlers', () => {
  it('calls page.unrouteAll with ignoreErrors straight after the test body, while the page is open', () => {
    const text = readFileSync(FIXTURES, 'utf8');
    const afterBody = text.slice(text.indexOf('browserLog._attach?.(page);'));
    expect(afterBody).toMatch(/^browserLog\._attach\?\.\(page\);\s*try \{\s*await use\(page\);\s*\} finally \{\s*(\/\/[^\n]*\n\s*)*await page\.unrouteAll\(\{ behavior: 'ignoreErrors' \}\);/);
  });

  it('does not drop routes in the browserLog fixture, whose teardown runs after the page has closed', () => {
    const text = readFileSync(FIXTURES, 'utf8');
    const start = text.indexOf('await use(log);');
    const afterLog = text.slice(start, text.indexOf('\n  }, ', start));
    expect(afterLog).not.toContain('unrouteAll');
  });
});
