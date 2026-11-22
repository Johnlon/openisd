/**
 * The storage popup fits on the screen: fully inside the window, no page scrollbar, its Close button
 * reachable. Desktop 1280x720 and a Pixel 9 in Chrome (374x705), nearly-full storage on a browser
 * that refuses to keep the data (the longest text it shows).
 */
import type {Page} from '@playwright/test';
import {expect, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

async function refusingNearlyFullBrowser(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('popup-layout-spec') === null) {
      localStorage.removeItem('openisd_persist_warning_dismissed');
      sessionStorage.setItem('popup-layout-spec', '1');
    }
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {persisted: () => Promise.resolve(false), persist: () => Promise.resolve(false), estimate: () => Promise.resolve({usage: 99, quota: 100})},
    });
  });
}

async function popupFits(page: Page): Promise<void> {
  const popup = page.getByRole('alertdialog', {name: 'Storage is nearly full'});
  await expect(popup).toBeVisible();
  const close = popup.getByRole('button', {name: 'Close', exact: true});
  await expect(close).toBeVisible();
  const view = page.viewportSize();
  if (view === null) throw new Error('no viewport');
  for (const locator of [popup, close]) {
    const box = await locator.boundingBox();
    if (box === null) throw new Error('no box');
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(view.width);
    expect(box.y + box.height).toBeLessThanOrEqual(view.height);
  }
  const scrolls = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight || document.documentElement.scrollWidth > window.innerWidth);
  expect(scrolls, 'the page has a scrollbar').toBe(false);
  const popupScrolls = await popup.evaluate(el => el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth);
  expect(popupScrolls, 'the popup has a scrollbar').toBe(false);
}

test('desktop: the storage popup fits the window', async ({page}) => {
  await refusingNearlyFullBrowser(page);
  await page.goto('/');
  await popupFits(page);
  await expect(page.getByRole('alertdialog')).toHaveCount(1);
});

test('phone at 374x705: the storage popup fits the window', async ({page}) => {
  await page.setViewportSize({width: 374, height: 705});
  await forceMobileSkin(page);
  await refusingNearlyFullBrowser(page);
  await page.goto('/');
  await popupFits(page);
  await expect(page.getByRole('alertdialog')).toHaveCount(1);
});
