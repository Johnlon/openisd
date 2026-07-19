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

// The Driver-editor and PR-edit modals live only in the Classic (WinISD) shell,
// so these two cases switch skins first via the header's Skin picker.
test('Escape dismisses the Driver editor modal', async ({ page }) => {
  await page.goto('/');
  await page.locator('.skin-picker select').selectOption({ label: 'Classic (WinISD)' });
  // Driver tab is the default; open its Edit (Brand/Model/notes) popup.
  await page.getByTitle(/Edit this driver's Brand\/Model\/notes/).click();
  const heading = page.getByRole('heading', { name: /Driver editor/ });
  await expect(heading).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(heading).toBeHidden();
});

test('Escape dismisses the passive-radiator Edit modal', async ({ page }) => {
  await page.goto('/');
  await page.locator('.skin-picker select').selectOption({ label: 'Classic (WinISD)' });
  // Switch the box to a passive-radiator alignment so its Edit popup exists.
  await page.getByRole('button', { name: 'Box', exact: true }).click();
  await page.locator('#boxtype').selectOption('pr');
  await page.getByRole('button', { name: 'Passive Radiator', exact: true }).click();
  await page.getByTitle(/Edit this passive radiator's own specs/).click();
  const heading = page.getByRole('heading', { name: /Edit passive radiator/ });
  await expect(heading).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(heading).toBeHidden();
});
