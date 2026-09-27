/**
 * The skin switch: automatic by viewport width (`logic/viewport.ts`, 600px breakpoint) with a
 * manual, persisted override (`presentationState.ui.skinOverride`, set from each shell's Info
 * menu). `App.vue`'s `activeSkin` combines the two, override winning when present.
 *
 * The viewport must be set BEFORE `page.goto('/')`: `App.vue` reads `matchMedia` synchronously
 * at setup time, before its first render, so the skin is decided from whatever viewport the
 * page already has at load — not from a later resize.
 */
import {expect, test} from '../fixtures.js';

test('the default (wide) viewport renders the desktop shell, with no mobile root in the DOM', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.original-root')).toBeVisible();
  await expect(page.locator('.mobile-root')).toHaveCount(0);
});

test('a phone-width viewport auto-detects into the mobile shell, with no desktop root in the DOM', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.mobile-root')).toBeVisible();
  await expect(page.locator('.original-root')).toHaveCount(0);
});

test('a viewport right at the breakpoint boundary: 600px is mobile, 601px is desktop', async ({ page }) => {
  await page.setViewportSize({ width: 600, height: 800 });
  await page.goto('/');
  await expect(page.locator('.mobile-root')).toBeVisible();

  await page.setViewportSize({ width: 601, height: 800 });
  await page.goto('/');
  await expect(page.locator('.original-root')).toBeVisible();
});

test('the Info menu\'s "Switch to Mobile view" overrides a wide viewport, and the choice survives a reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.original-root')).toBeVisible();

  await page.locator('.tb-btn[title="Info"]').click();
  await page.getByText('Switch to Mobile view').click();
  await expect(page.locator('.mobile-root')).toBeVisible();
  await expect(page.locator('.original-root')).toHaveCount(0);

  // Still a wide viewport — only the persisted override explains staying on the mobile shell.
  await page.reload();
  await expect(page.locator('.mobile-root')).toBeVisible();
});

test('the mobile shell\'s "Switch to Desktop view" overrides a narrow viewport, and the choice survives a reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.mobile-root')).toBeVisible();

  await page.getByText('Switch to Desktop view').click();
  await expect(page.locator('.original-root')).toBeVisible();
  await expect(page.locator('.mobile-root')).toHaveCount(0);

  // Still a narrow viewport — only the persisted override explains staying on the desktop shell.
  await page.reload();
  await expect(page.locator('.original-root')).toBeVisible();
});
