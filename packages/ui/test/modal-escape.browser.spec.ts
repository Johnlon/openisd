import { test, expect } from './fixtures.js';

// Design rule (.claude/context/ui-rules.md): pressing Escape dismisses any open modal.
// The browserLog auto-fixture also asserts a clean console + network throughout.

test('Escape dismisses the driver library modal', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Browse \/ Select/ }).click();
  await expect(page.locator('.modal')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.modal')).toBeHidden();
});

test('Escape dismisses the Define Driver modal', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Define new/ }).click();
  await expect(page.locator('.dd-overlay')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.dd-overlay')).toBeHidden();
});
