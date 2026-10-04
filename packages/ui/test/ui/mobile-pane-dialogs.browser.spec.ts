/**
 * Manage drivers, Project details and Advanced open as dialogs in the Options style (John,
 * 2026-10-04): full-screen, title with a top-right ✕, body, footer button; closing returns to
 * the tab underneath. A dialog never changes size for a workflow, e.g. the Favourites toggle.
 */
import {expect, openAMobileProject, test} from '../fixtures.js';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('openisd_view', JSON.stringify({ ui: { splashSeen: true, skinOverride: 'mobile' } }));
  });
  await page.goto('/');
  await openAMobileProject(page);
});

async function openFromMenu(page: import('@playwright/test').Page, item: string) {
  await page.locator('.mob-hamburger').click();
  await page.locator('.mob-menu-item', { hasText: item }).click();
}

for (const [item, title] of [['Manage Drivers', 'Manage drivers'], ['Project details', 'Project'], ['Advanced', 'Advanced']] as const) {
  test(`${item} is a dialog with a title, a top-right ✕ and closes back to the Box tab`, async ({ page }) => {
    await openFromMenu(page, item);
    const dlg = page.locator('.mob-dlg');
    await expect(dlg.locator('.mob-dlg-title')).toHaveText(title);
    const shell = (await page.locator('.mobile-root').boundingBox())!;
    expect(await dlg.boundingBox()).toEqual(shell);
    const x = dlg.locator('.mob-dlg-close');
    const box = (await x.boundingBox())!;
    expect(box.x + box.width).toBeGreaterThan(shell.x + shell.width - 60);
    expect(box.y).toBeLessThan(60);
    await x.click();
    await expect(dlg).toHaveCount(0);
    await expect(page.locator('.mob-tab.active', { hasText: 'Box' })).toBeVisible();
  });
}

test('every pane dialog has a Close button in the footer', async ({ page }) => {
  await openFromMenu(page, 'Project details');
  await page.locator('.mob-dlg-footer').getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.mob-dlg')).toHaveCount(0);
  await openFromMenu(page, 'Advanced');
  await page.locator('.mob-dlg-footer').getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.mob-dlg')).toHaveCount(0);
  await openFromMenu(page, 'Manage Drivers');
  await page.locator('.mob-dlg-footer').getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.mob-dlg')).toHaveCount(0);
});

test('turning Favourites on does not change the Manage drivers dialog size', async ({ page }) => {
  await openFromMenu(page, 'Manage Drivers');
  const dlg = page.locator('.mob-dlg');
  const lib = page.locator('.driver-library');
  await expect(lib).toBeVisible();
  const before = { dlg: await dlg.boundingBox(), lib: await lib.boundingBox() };
  await page.locator('.fav-filter').click();
  await expect(page.locator('.fav-filter.active')).toBeVisible();
  expect(await dlg.boundingBox()).toEqual(before.dlg);
  expect(await lib.boundingBox()).toEqual(before.lib);
});
