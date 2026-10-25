/**
 * The Save all flash says what was saved, then how many projects are stored and how much of the
 * browser's storage they use; a new tab says the same at startup, once (John, 17 Oct 2026). Both skins.
 */
import type {Page} from '@playwright/test';
import {expect, openAMobileProject, openAProject, setFocusedBoxVolume, test} from '../fixtures.js';
import {forceMobileSkin, tapMobileMenuItem} from '../fixtures/mobileSkin.js';
import {PIXEL_9} from '../fixtures/phoneSizes.js';

const SAVED = /^Saved 1 project\. 1 project, [\d.]+ KB of 5 MB used\.$/;
const STARTUP = /^1 project, [\d.]+ KB of 5 MB used\.$/;

/** A second tab of the same browser: it shares the saved projects, not the first tab's session. */
async function newTab(page: Page, phone: boolean): Promise<Page> {
  const tab = await page.context().newPage();
  if (phone) {
    await tab.setViewportSize(PIXEL_9);
    await forceMobileSkin(tab);
  }
  await tab.goto('/');
  return tab;
}

test('desktop: Save all flashes what was saved and the storage used', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await setFocusedBoxVolume(page, 0.012);
  await page.locator('.tb-btn[title^="Save all"]').click();
  await expect(page.locator('.flash')).toHaveText(SAVED);
});

test('mobile: Save all flashes what was saved and the storage used', async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await setFocusedBoxVolume(page, 0.012);
  await tapMobileMenuItem(page, /^Save all$/);
  await expect(page.getByTestId('flash-strip')).toHaveText(SAVED);
});

test('desktop: a new tab flashes the stored projects and storage used, once', async ({page}) => {
  await page.goto('/');
  await openAProject(page);
  await setFocusedBoxVolume(page, 0.012);
  await page.locator('.tb-btn[title^="Save all"]').click();
  await expect(page.locator('.flash')).toHaveText(SAVED);

  const tab = await newTab(page, false);
  await expect(tab.locator('.flash')).toHaveText(STARTUP);
  await tab.reload();
  await expect(tab.locator('.tb-btn').first()).toBeVisible();
  await expect(tab.locator('.flash')).toHaveCount(0);
});

test('mobile: a new tab flashes the stored projects and storage used, once, unclipped', async ({page}) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await setFocusedBoxVolume(page, 0.012);
  await tapMobileMenuItem(page, /^Save all$/);
  await expect(page.getByTestId('flash-strip')).toHaveText(SAVED);

  const tab = await newTab(page, true);
  const strip = tab.getByTestId('flash-strip');
  await expect(strip).toHaveText(STARTUP);
  const box = await strip.boundingBox();
  expect(box !== null && box.x >= 0 && box.x + box.width <= PIXEL_9.width).toBe(true);
  expect(await tab.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await tab.reload();
  await expect(tab.locator('.mobile-root')).toBeVisible();
  await expect(strip).toHaveCount(0);
});
