/**
 * T501 (John, 20 Oct 2026, on his 374x705 phone): the passive radiator library says "define one
 * below" but the Define and Done buttons had scrolled off the screen. They sit in a footer that
 * stays on screen; only the list scrolls.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import type {Page} from '@playwright/test';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ appPage: page }) => {
  await page.setViewportSize({ width: 374, height: 705 });
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', { hasText: 'Box' }).click();
  await page.locator('#mob-box-type').selectOption('box-passive-radiator');
  await page.locator('.mob-tab', { hasText: 'Passive Radiator' }).click();
});

async function openLibrary(page: Page) {
  await page.getByRole('button', { name: 'Select passive radiator' }).click();
  await page.locator('.pr-filter').waitFor({ state: 'visible' });
}

async function expectButtonsOnScreen(page: Page) {
  const modal = page.locator('.overlay.on .modal');
  const vp = page.viewportSize()!;
  for (const name of [/Define new passive radiator/, 'Done']) {
    const box = await modal.getByRole('button', { name }).boundingBox();
    expect(box, String(name)).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(vp.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(vp.height);
  }
  const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  expect(noHScroll).toBe(true);
}

test('with the Saved list empty, Define and Done are on screen', async ({ appPage: page }) => {
  await openLibrary(page);
  await expect(page.getByText('No saved passive radiators yet')).toBeVisible();
  await expectButtonsOnScreen(page);
});

test('with many saved radiators the list scrolls and Define and Done stay on screen', async ({ appPage: page }) => {
  for (let i = 1; i <= 12; i++) {
    await page.getByRole('button', { name: 'Save to library' }).click();
    const dialog = page.getByRole('dialog', { name: 'Save passive radiator to library' });
    await dialog.locator('input').fill(`Saved PR ${i}`);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toHaveCount(0);
  }
  await openLibrary(page);
  await expect(page.locator('.pr-lib-item .pr-lib-name', { hasText: 'Saved PR 12' })).toBeAttached();
  await expectButtonsOnScreen(page);
});
