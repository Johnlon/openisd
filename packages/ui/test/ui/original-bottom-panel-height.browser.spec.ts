import {expect, openAProject, test} from '../fixtures.js';

/**
 * The bottom tab panel is one height: the tallest tab of any box type (or the tab bar beside it)
 * plus the panel padding. It never changes with the tab or the box type, and it holds no empty
 * grey beyond that. It was a fixed 206 px, 12 px more than the tallest tab needs
 * (John, 2026-10-15: "as deep as the tallest tab in the app").
 */
const PADDING_AND_BORDER = 22;
const SLACK = 4;

test('one panel height across every box type and tab, equal to the tallest tab plus the bar', async ({page}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({width: 1880, height: 1000});
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', {hasText: /^Box$/}).click();
  const boxes = await page.locator('#og-box-type option').evaluateAll(os => os.flatMap(o => (o instanceof HTMLOptionElement ? [o.value] : [])));

  const heights: Record<string, number> = {};
  let tallest = 0;
  for (const box of boxes) {
    await page.locator('.project-nav li', {hasText: /^Box$/}).click();
    await page.locator('#og-box-type').selectOption(box);
    const tabCount = await page.locator('.project-nav li').count();
    for (let i = 0; i < tabCount; i++) {
      await page.locator('.project-nav li').nth(i).click();
      const m = await page.evaluate(() => {
        const section = document.querySelector('.tab-section.active')!;
        const top = section.getBoundingClientRect().top;
        const content = Math.max(0, ...[...section.querySelectorAll('*')].map(e => e.getBoundingClientRect().bottom)) - top;
        const navBar = document.querySelector('.project-nav')!.scrollHeight
          + (document.querySelector('.quad-bottomleft .panel-title')?.getBoundingClientRect().height ?? 0);
        return {
          panel: Math.round(document.querySelector('.content-panel')!.getBoundingClientRect().height),
          need: Math.max(content, navBar),
          sideways: section.scrollWidth > section.clientWidth,
          down: section.scrollHeight > section.clientHeight,
        };
      });
      expect(m.sideways, `${box} tab ${i} scrolls sideways`).toBe(false);
      expect(m.down, `${box} tab ${i} scrolls down`).toBe(false);
      heights[`${box}/${i}`] = m.panel;
      tallest = Math.max(tallest, m.need);
    }
  }

  const distinct = [...new Set(Object.values(heights))];
  expect(distinct, `panel height per box type and tab: ${JSON.stringify(heights)}`).toHaveLength(1);
  expect(distinct[0]).toBeLessThanOrEqual(tallest + PADDING_AND_BORDER + SLACK);
});
