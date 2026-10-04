/**
 * The mobile Filters tab. Logic and UI are both reused unchanged from the desktop skin
 * (OriginalFilters / OriginalFilters.vue) — these specs prove the mobile tab reaches them and
 * they render at phone width, not that the filter chain itself behaves correctly
 * (OriginalFilters'/the engine's own spec files cover that).
 */
import {expect, openAMobileProject, test} from '../fixtures.js';
import {forceMobileSkin} from '../fixtures/mobileSkin.js';

test.beforeEach(async ({ page }) => {
  await forceMobileSkin(page);
  await page.goto('/');
  await openAMobileProject(page);
  await page.locator('.mob-tab', { hasText: 'Filters' }).click();
});

test('shows the quick-add row and an empty list with no filters yet', async ({ page }) => {
  await expect(page.getByText('+ LP', { exact: true })).toBeVisible();
  await expect(page.getByText('No filters active.')).toBeVisible();
});

test('adding a filter opens its editor immediately, and it survives switching tabs', async ({ page }) => {
  await page.getByText('+ LP', { exact: true }).click();
  await expect(page.getByText('Cutoff')).toBeVisible();

  await page.locator('.mob-tab', { hasText: 'Box' }).click();
  await page.locator('.mob-tab', { hasText: 'Filters' }).click();
  await expect(page.getByText('Lowpass', { exact: false })).toBeVisible();
});

test('removing a filter clears the list back to empty', async ({ page }) => {
  await page.getByText('+ HP', { exact: true }).click();
  await expect(page.getByText('No filters active.')).toBeHidden();

  await page.locator('.filter-del').click();
  await expect(page.getByText('No filters active.')).toBeVisible();
});

test('an order-4 allpass shows the WinISD deviation cue, and its dialog fits the phone width', async ({ page }) => {
  await page.getByText('+ AP', { exact: true }).click();
  const order = page.locator('.filter-edit-body label').filter({ hasText: /^Order\b/ }).locator('input');
  await order.fill('4');
  await order.blur();
  const cue = page.locator('button.winisd-deviation-cue');
  await expect(cue).toBeVisible();
  await cue.click();
  const dialog = page.getByRole('dialog', { name: /allpass/i });
  await expect(dialog).toContainText('no switch');
  const box = (await dialog.boundingBox())!;
  const width = page.viewportSize()!.width;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
});
