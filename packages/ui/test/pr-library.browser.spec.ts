import { test, expect } from './fixtures.js';

// Passive radiators have no WDR (WinISD doesn't model them), so they are bundled
// separately and surfaced only in the Browse-PR popup — never the woofer/tweeter
// driver browser. This spec drives that popup end-to-end: it lists bundled PRs and
// loading one fills the published Sd/Cms (Vas derives), leaving Fs/Mms/Rms/Xmax blank.

async function openPrEditor(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.locator('.skin-picker select').selectOption({ label: 'Classic (WinISD)' });
  await page.getByRole('button', { name: 'Box', exact: true }).click();
  await page.locator('#boxtype').selectOption('pr');
  await page.getByRole('button', { name: 'Passive Radiator', exact: true }).click();
  await page.getByTitle(/Edit this passive radiator's own specs/).click();
  await expect(page.getByRole('heading', { name: /Edit passive radiator/ })).toBeVisible();
}

test('Browse-PR popup lists bundled passive radiators and loads one', async ({ page }) => {
  await openPrEditor(page);

  await page.getByRole('button', { name: /Browse PR library/ }).click();
  const bundled = page.locator('.pr-lib-name', { hasText: 'PR178WA01' });
  await expect(bundled).toBeVisible();

  await bundled.click();

  // Loaded: name is the bundled model; Sd is the published 0.0131 m² → 131 cm².
  const prName = page.locator('.row', { hasText: 'PR name' }).locator('input');
  await expect(prName).toHaveValue(/PR178WA01/);
  const sd = page.locator('.row', { hasText: 'Sd' }).locator('input').first();
  await expect(sd).toHaveValue(/^131/);
});
