/**
 * BUG_20261031_advanced-tab-scrolls-sideways-at-1280 (T634): the air fields of the desktop Advanced tab
 * wrap their two columns under each other when the pane is narrow, so the tab fits at 1280 px.
 */
import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const SHELL = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'ui', 'shells', 'original', 'OriginalShell.vue');
const text = readFileSync(SHELL, 'utf8');

function rule(selector: string): string {
  const start = text.indexOf(`\n${selector} {`);
  expect(start, `rule ${selector}`).toBeGreaterThan(-1);
  return text.slice(start, text.indexOf('}', start));
}

describe('Advanced tab air fields wrap instead of forcing a sideways scroll', () => {
  it('is a wrapping flex row, not a fixed two-column grid', () => {
    const body = rule('.adv-air-fields');
    expect(body).toContain('display:flex');
    expect(body).toContain('flex-wrap:wrap');
    expect(body).not.toContain('grid-template-columns');
  });

  it('may shrink inside the Advanced row', () => {
    expect(rule('.adv-two-col > .adv-air-fields')).toContain('flex:0 1 auto');
  });

  it('keeps the two switch groups in one nowrap row', () => {
    expect(rule('.sim-switches')).toContain('flex-flow: row nowrap');
  });

  it('puts the entered rows and the calculated rows in their own column wrappers', () => {
    expect(text.match(/class="adv-air-col"/g)).toHaveLength(2);
  });
});
