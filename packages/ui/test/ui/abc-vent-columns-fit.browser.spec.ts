/**
 * ABC's three port columns stay inside the bottom Vents panel on a narrow window: every control is
 * inside the pane and the pane shows no scrollbar (T607 carried onto main by T671).
 */
import {expect, openAProject, test} from '../fixtures.js';
import type {Page} from '@playwright/test';

const SIZES = [{width: 1024, height: 768}, {width: 1280, height: 720}];

/** Controls of the active pane that reach outside it, as "id or tag" strings. */
async function clippedControls(page: Page): Promise<string[]> {
  return page.locator('.vent-pane-tight').evaluate(pane => {
    const bounds = pane.getBoundingClientRect();
    const out: string[] = [];
    for (const control of pane.querySelectorAll('input, select, button')) {
      const box = control.getBoundingClientRect();
      if (box.width === 0) continue;
      if (control instanceof HTMLElement && control.scrollWidth > control.clientWidth + 1 && control.tagName === 'SELECT') out.push(`${control.id} text cut`);
      if (box.left < bounds.left - 0.5 || box.right > bounds.right + 0.5) out.push(`${control.id || control.tagName} ${Math.round(box.left)}-${Math.round(box.right)} in ${Math.round(bounds.left)}-${Math.round(bounds.right)}`);
    }
    for (const label of pane.querySelectorAll('label')) {
      if (label.scrollWidth > label.clientWidth + 1) out.push(`label "${label.textContent}" cut`);
    }
    return out;
  });
}

for (const size of SIZES) {
  test.describe(`${size.width}x${size.height}`, () => {
    test.use({viewport: size});

    test('ABC vent columns fit the pane with no clipped control and no scrollbar', async ({page}) => {
      await page.goto('/');
      await openAProject(page);
      await expect(page.getByText(/Project imported/)).toBeHidden();
      await page.locator('#og-box-type').selectOption('abc');
      await page.locator('.project-nav li', {hasText: 'ABC'}).click();
      await expect(page.locator('.vent-col')).toHaveCount(3);
      expect(await clippedControls(page)).toEqual([]);
      const scrolls = await page.locator('.vent-pane-tight').evaluate(pane => {
        const walk: Element[] = [pane, ...Array.from(pane.querySelectorAll('*'))];
        if (pane.parentElement !== null) walk.push(pane.parentElement);
        return walk.filter(el => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'visible').map(el => String(el.className));
      });
      expect(scrolls).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  });
}
