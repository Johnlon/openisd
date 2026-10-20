/**
 * The ▲▼ step buttons act as on a phone (the button keeps focus, the keyboard stays down) whenever
 * the mobile skin is on screen, however it got there: a phone-sized window or the saved layout choice.
 */
import {expect, openAMobileProject, openAProject, test} from '../fixtures.js';
import {mobileFieldRow} from '../fixtures/mobileSkin.js';

test('on a phone-sized window with no saved layout choice, a mouse click on ▲ focuses the button, not the field', async ({ page }) => {
  await page.setViewportSize({ width: 412, height: 900 });
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', { hasText: 'Signal' }).click();
  const row = mobileFieldRow(page, 'Rs');
  const upButton = row.locator('.num-stepper-btn').first();

  await upButton.click();

  await expect(upButton).toBeFocused();
  await expect(row.locator('input')).not.toBeFocused();
});

test('on a wide window the desktop box keeps focus when ▲ is clicked', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', { hasText: /^Signal$/ }).click();
  const row = page.locator('.field', { hasText: 'Series resistance' }).first();
  const box = row.locator('input').first();

  await row.locator('.num-stepper-btn').first().click();

  await expect(box).toBeFocused();
});
