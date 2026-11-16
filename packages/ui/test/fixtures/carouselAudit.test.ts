/**
 * T846: both layout audits exempt only the sideways scroll of a [data-carousel] strip (John, 16 Nov 2026, QO946.c132).
 * The rendered behaviour, including that the same strip without the marker still fails, is in
 * test/ui/carousel-audit.browser.spec.ts; this pins the source it rests on.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (file: string): string => readFileSync(join(here, file), 'utf8');

describe('carousel exemption in the layout audits', () => {
  it('the whole-screen audit exempts only the strip\'s own sideways scroll and still checks its frame', () => {
    const source = read('wholeScreenAudit.ts');
    assert.ok(source.includes("!panel.hasAttribute('data-carousel')"));
    assert.ok(source.includes("root.querySelectorAll('[data-carousel]')"));
  });
  it('the screen-size audit measures a carousel control as painted inside the strip and checks the strip frame', () => {
    const source = read('screenSizeAudit.ts');
    assert.ok(source.includes("closest('[data-carousel]')"));
    assert.ok(source.includes('carousel off screen sideways'));
  });
});
