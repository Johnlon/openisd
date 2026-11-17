/**
 * T788: the phone Filters tab add-filter chips are a one-line carousel again (John, 8 Nov 2026: "the strip is a
 * carousel"), at a font a little smaller than the 15 px of the other phone buttons so the chips fit better. The
 * rendered behaviour is in mobile-filters-tab.browser.spec.ts; this pins the source it rests on.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const SFC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'ui', 'shells', 'mobile', 'MobileFiltersTab.vue');
const source = readFileSync(SFC, 'utf8');
const rule = (selector: string): string => {
  const m = source.split('\n').find(l => l.startsWith(selector + ' {'));
  assert.ok(m, `no CSS rule for ${selector}`);
  return m;
};

describe('MobileFiltersTab chip carousel', () => {
  it('the strip is one line that scrolls sideways inside itself, not a wrapping block', () => {
    const strip = rule('.mob-fstrip');
    assert.ok(!strip.includes('flex-wrap'));
    assert.ok(strip.includes('overflow-x: auto'));
    assert.ok(source.includes('<div ref="strip" class="mob-fstrip" data-carousel'));
  });

  it('the chips never wrap their text and are 13 px', () => {
    const chip = rule('.mob-fstrip .mob-btn');
    assert.ok(chip.includes('white-space: nowrap'));
    assert.ok(chip.includes('font-size: 13px'));
  });

  it('the arrows sit beside the strip, outside it', () => {
    assert.ok(source.indexOf('mob-fstrip-prev') < source.indexOf('class="mob-fstrip"'));
    assert.ok(source.indexOf('class="mob-fstrip"') < source.indexOf('mob-fstrip-next'));
  });
});
