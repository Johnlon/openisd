/**
 * The storage warning banner takes its own layout space: no other part of the screen sits under it,
 * and the screen below it still fits (nothing pushed off the bottom, no page scrollbar).
 */
import type {Locator, Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

async function boxOf(locator: Locator): Promise<{readonly y: number; readonly height: number}> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error('element has no box');
  return box;
}

async function refusingBrowser(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('banner-layout-spec') === null) {
      localStorage.removeItem('openisd_persist_warning_dismissed');
      sessionStorage.setItem('banner-layout-spec', '1');
    }
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {persisted: () => Promise.resolve(false), persist: () => Promise.resolve(false), estimate: () => Promise.resolve({usage: 1, quota: 100})},
    });
  });
}

/** Every other in-flow child of the screen root whose box overlaps the banner's box, by name. */
async function boxesUnderTheBanner(page: Page, rootSelector: string): Promise<string[]> {
  return page.locator(rootSelector).evaluate(root => {
    const banner = root.querySelector('.persist-banner');
    if (banner === null) return ['no banner'];
    const b = banner.getBoundingClientRect();
    const overlapping: string[] = [];
    for (const child of Array.from(root.children)) {
      if (child === banner) continue;
      const style = getComputedStyle(child);
      if (style.position === 'fixed' || style.position === 'absolute' || style.display === 'none') continue;
      const r = child.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const across = Math.min(r.right, b.right) - Math.max(r.left, b.left);
      const down = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top);
      if (across > 0 && down > 0) overlapping.push(`${child.className} (${Math.round(down)} px)`);
    }
    return overlapping;
  });
}

async function screenFits(page: Page, rootSelector: string): Promise<void> {
  const fit = await page.locator(rootSelector).evaluate(root => ({
    pageScrolls: document.documentElement.scrollHeight > window.innerHeight || document.documentElement.scrollWidth > window.innerWidth,
    lastBottom: Math.max(...Array.from(root.children).filter(c => getComputedStyle(c).position === 'static' || getComputedStyle(c).position === 'relative').map(c => c.getBoundingClientRect().bottom)),
    height: window.innerHeight,
  }));
  expect(fit.pageScrolls, 'the page has a scrollbar').toBe(false);
  expect(fit.lastBottom, 'something is pushed past the bottom of the window').toBeLessThanOrEqual(fit.height + 1);
}

test('desktop: the storage banner covers nothing and the screen below it fits', async ({page}) => {
  await refusingBrowser(page);
  await page.goto('/');
  await expect(page.locator('.persist-banner')).toBeVisible();
  await openAProject(page);
  expect(await boxesUnderTheBanner(page, '.original-root')).toEqual([]);
  await screenFits(page, '.original-root');
  const banner = await boxOf(page.locator('.persist-banner'));
  const below = await boxOf(page.locator('.persist-banner + *').first());
  expect(below.y).toBeGreaterThanOrEqual(banner.y + banner.height - 1);
});

test('mobile: the storage banner covers nothing and the screen below it fits', async ({page}) => {
  await forceMobileSkin(page);
  await refusingBrowser(page);
  await page.goto('/');
  await expect(page.locator('.persist-banner')).toBeVisible();
  await openAMobileProject(page);
  expect(await boxesUnderTheBanner(page, '.mobile-root')).toEqual([]);
  await screenFits(page, '.mobile-root');
});
