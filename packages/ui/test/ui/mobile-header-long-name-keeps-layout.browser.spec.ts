import type {Page} from '@playwright/test';
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';
import {connectedToDrive} from './fixtures/driveConnected.js';

/**
 * The phone header holds whatever the project is called (T899, John 18 Nov 2026: "header is multiple line , looks ok as long as
 * it doesn't cause header to breakmup"). A name may wrap onto two or three lines; the bar keeps its height, the logo, cloud badge
 * and Save button stay where they are and apart from the name, every line of the name is inside the bar, and a name too long for
 * three lines is cut with an ellipsis and carries its full text as the title.
 */
const NAMES = ['AS168-9-470 closed', '8SW-4HE passive radiator', 'AS168-9-470 closed with a very long prototype description that cannot fit three lines at all'];

type Box = {left: number; right: number; top: number; bottom: number};

/** Where every part of the header and the strip and tab bar around the content sit, and how the name lays out. */
async function measure(page: Page): Promise<{fixed: Record<string, Box>; nameLines: number; title: string | null; truncated: boolean}> {
  return page.evaluate(() => {
    const box = (sel: string): Box => {
      const r = document.querySelector(sel)!.getBoundingClientRect();
      return {left: r.left, right: r.right, top: r.top, bottom: r.bottom};
    };
    const text = document.querySelector('.mob-project-title-text')!;
    const cell = box('.mob-project-title');
    const range = document.createRange();
    range.selectNodeContents(text);
    // Lines the clamp hides still have boxes: count the ones inside the name's cell.
    const rects = Array.from(range.getClientRects()).filter(r => r.bottom <= cell.bottom + 0.5);
    return {
      fixed: {bar: box('.mob-topbar'), brand: box('.mob-brand'), hamburger: box('.mob-hamburger'), sync: box('.mob-header-sync'), save: box('.mob-save'), name: cell, content: {...box('.mob-content'), bottom: 0}, tabbar: box('.mob-tabbar')},
      nameLines: new Set(rects.map(r => Math.round(r.top))).size,
      title: document.querySelector('.mob-project-title')!.getAttribute('title'),
      truncated: text.scrollHeight > text.clientHeight,
    };
  });
}

/** Every measured part except the name's own cell, which is the one allowed to change. */
const HEADER_AND_CONTENT = ['bar', 'brand', 'hamburger', 'sync', 'save', 'content', 'tabbar'] as const;

for (const width of [360, 390]) {
  test(`${width} px wide: short, 3-line and very long names leave every part of the header and the content where it was`, async ({page}) => {
    await page.setViewportSize({width, height: 844});
    await forceMobileSkin(page);
    await connectedToDrive(page);
    let reference: Awaited<ReturnType<typeof measure>>['fixed'] | null = null;
    for (const name of NAMES) {
      await page.goto('/');
      await openAMobileProject(page, undefined, `${name}.owpr`);
      await expect(page.locator('.mob-header-sync')).toBeVisible();
      const h = await measure(page);
      const {bar, brand, name: cell, sync, save} = h.fixed;
      reference ??= h.fixed;
      // Everything but the name's own cell is exactly where the short name left it: nothing grew, moved or was pushed.
      for (const part of HEADER_AND_CONTENT) expect(h.fixed[part], `${name}: ${part}`).toEqual(reference[part]);
      // The name is inside the bar and between the logo and the cloud badge.
      expect(cell.top, name).toBeGreaterThanOrEqual(bar.top);
      expect(cell.bottom, name).toBeLessThanOrEqual(bar.bottom);
      expect(cell.left, name).toBeGreaterThanOrEqual(brand.right - 0.5);
      expect(cell.right, name).toBeLessThanOrEqual(sync.left + 0.5);
      expect(sync.right, name).toBeLessThanOrEqual(save.left + 0.5);
      expect(h.nameLines, name).toBeLessThanOrEqual(3);
      expect(h.title, name).toBe(name);
      expect(await page.locator('.mob-project-title').evaluate(el => el.scrollWidth > el.clientWidth), name).toBe(false);
      // Only a name that does not fit three lines is truncated.
      expect(h.truncated, name).toBe(name === NAMES[2]);
    }
  });
}
