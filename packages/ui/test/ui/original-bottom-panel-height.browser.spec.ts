import {expect, openAProject, test} from '../fixtures.js';

/**
 * The bottom tab panel is one height: the tallest tab of any box type (or the tab bar beside it)
 * plus the panel's bottom padding. It never changes with the tab or the box type, and it holds no
 * empty grey beyond that. It was a fixed 206 px, 12 px more than the tallest tab needs
 * (John, 2026-10-15: "as deep as the tallest tab in the app").
 *
 * One test per box type, so each stays well inside the shared test timeout; the last test compares
 * what they measured.
 */
const BOX_TYPES = ['sealed', 'vented', 'bandpass4', 'bandpass6', 'abc', 'box-passive-radiator'];
/** The panel's bottom padding and border below the last row. */
const BELOW_LAST_ROW = 11;

const heights = new Set<number>();
let tallest = 0;
const needs: string[] = [];

test.describe.configure({mode: 'serial'});

for (const box of BOX_TYPES) {
  test(`${box}: the panel keeps one height across its tabs and nothing scrolls`, async ({page}) => {
    await page.setViewportSize({width: 1880, height: 1000});
    await page.goto('/');
    await openAProject(page);
    await page.locator('.project-nav li', {hasText: /^Box$/}).click();
    await page.locator('#og-box-type').selectOption(box);

    const tabCount = await page.locator('.project-nav li').count();
    for (let i = 0; i < tabCount; i++) {
      await page.locator('.project-nav li').nth(i).click();
      for (const shape of await page.locator('.tab-section.active select[id*="vent-shape"]').all()) await shape.selectOption('slotted');
      const m = await page.evaluate(() => {
        const panel = document.querySelector('.content-panel')!.getBoundingClientRect();
        const section = document.querySelector('.tab-section.active')!;
        // The final row includes its bottom margin; a border-box-only read omits it.
        const content = Math.max(0, ...[...section.querySelectorAll('*')].map(e => e.getBoundingClientRect().bottom + parseFloat(getComputedStyle(e).marginBottom))) - panel.top;
        const navBar = document.querySelector('.project-nav')!.scrollHeight
          + (document.querySelector('.quad-bottomleft .panel-title')?.getBoundingClientRect().height ?? 0);
        return {
          panel: Math.round(panel.height),
          need: Math.ceil(Math.max(content, navBar)),
          sideways: section.scrollWidth > section.clientWidth,
          down: section.scrollHeight > section.clientHeight,
        };
      });
      expect(m.sideways, `${box} tab ${i} scrolls sideways`).toBe(false);
      expect(m.down, `${box} tab ${i} scrolls down`).toBe(false);
      heights.add(m.panel);
      tallest = Math.max(tallest, m.need);
      needs.push(`${box} tab ${i}: ${m.need}`);
    }
  });
}

test('one height across every box type, no deeper than the tallest tab plus its padding', () => {
  expect([...heights]).toHaveLength(1);
  expect([...heights][0], `tallest tabs: ${needs.filter(n => n.endsWith(`: ${tallest}`)).join('; ')}`).toBeLessThanOrEqual(tallest + BELOW_LAST_ROW);
});
