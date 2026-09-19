import {expect, openAProject, test} from '../fixtures.js';

// Design rule: pressing Escape dismisses any open modal.
// The browserLog auto-fixture also asserts a clean console + network throughout.
//
// Both affordances live on the Driver tab of the bottom panel (the tab rail is persisted UI
// state and defaults to Box), so every test switches to the tab it intends — the
// ui-bugfix.md testing creed. The old "Define new" button and its `.dd-overlay` modal are
// long gone from the shell; the governed way into the driver editor is the picker's
// "Add new Driver" (DriverBrowser.vue), which opens the same `.de-modal`.

test('Escape dismisses the driver library modal', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.getByRole('button', { name: 'Select Driver' }).click();
  // The library is .wb-modal; the shell hosts several .modal siblings, so scope it.
  const library = page.locator('.wb-modal');
  await expect(library).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(library).toBeHidden();
});

test('Escape dismisses the driver editor opened from the library', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.project-nav li', { hasText: 'Driver' }).click();
  await page.getByRole('button', { name: 'Select Driver' }).click();
  await page.getByRole('button', { name: 'Add new Driver' }).click();
  await expect(page.locator('.de-modal')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.de-modal')).toBeHidden();
});
