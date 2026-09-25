import {expect, openAProject, test} from '../fixtures.js';
import {MY_DRIVERS_KEY, myDriversJson} from '../fixtures/seedMyDrivers.js';

// A saved driver need not carry a `name` — one saved from a record whose brand and model are
// known has those instead. Its row must still read as something and still be findable, so the
// picker derives the label with `driverShort()` (manufacturer and brand collapse when equal)
// rather than reading `.name` raw, which rendered a blank row that no search could match.

test('a saved driver with no name is listed and searchable under its derived name', async ({ page }) => {
  await page.addInitScript(([key, json]) => {
    localStorage.setItem(key, json);
  }, [MY_DRIVERS_KEY, myDriversJson([{
    brand: 'Dayton Audio',
    model: 'Epique Series E150HE-44',
    specs: {
      Fs_hz: 41, Qts: 0.35, Qes: 0.38, Qms: 4.5, Vas_m3: 0.028, Sd_m2: 0.0132,
      Re_ohm: 5.4, Le_H: 0.5e-3, Xmax_m: 0.0055, Pe_W: 70, Znom_ohm: 8,
    },
  }])] as const);
  await page.goto('/');
  await openAProject(page);
  await page.locator('[title*="librar" i]').first().click();
  await page.locator('input.filter').fill('Epique');

  // Manufacturer and brand are identical, so the label collapses to one "Dayton Audio".
  const driverRow = page.locator('.my-ditem', { hasText: 'Dayton Audio Epique Series E150HE-44' });
  await expect(driverRow).toBeVisible();

  // Choosing it embeds it in the project and closes the picker (docs/design/STATE_MODEL.md rule 1).
  await driverRow.locator('b').click();
  await page.locator('.use-btn').click();

  await expect(page.locator('.modal:not(.de-modal)')).toBeHidden();
  await expect(page.locator('.de-modal')).toBeHidden();
  await page.locator('li', { hasText: 'Driver' }).click();
  await expect(page.locator('.driver-id-row input').nth(1)).toHaveValue(/E150HE-44/);
});

test('the delete button removes a saved driver that carries no name', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.evaluate(([key, json]) => {
    localStorage.setItem(key, json);
  }, [MY_DRIVERS_KEY, myDriversJson([
    { brand: 'Dayton Audio', model: 'Epique Series E150HE-44', specs: { Fs_hz: 41, Qts: 0.35, Qes: 0.38, Qms: 4.5, Vas_m3: 0.028, Sd_m2: 0.0132, Re_ohm: 5.4, Le_H: 0.5e-3, Xmax_m: 0.0055, Pe_W: 70, Znom_ohm: 8 } },
    { brand: 'Dayton Audio', model: 'RS180-8', specs: { Fs_hz: 37, Qts: 0.38, Qes: 0.42, Qms: 4.0, Vas_m3: 0.030, Sd_m2: 0.0133, Re_ohm: 5.6, Le_H: 0.5e-3, Xmax_m: 0.005, Pe_W: 60, Znom_ohm: 8 } },
  ])] as const);
  await page.goto('/');

  await openAProject(page);
  await page.locator('[title*="librar" i]').first().click();
  const row = page.locator('.my-ditem', { hasText: 'Dayton Audio Epique Series E150HE-44' });
  await expect(row).toBeVisible();

  await row.locator('.my-del').click();

  // Deletion is keyed on <brand>/<model>, so the OTHER unnamed driver survives.
  await expect(row).toBeHidden();
  const left = await page.evaluate((key) => {
    const raw = localStorage.getItem(key);
    const env = raw ? JSON.parse(raw) as { entries?: { record?: { model?: { value?: string } } }[] } : { entries: [] };
    return (env.entries ?? []).map(e => e.record?.model?.value ?? '');
  }, MY_DRIVERS_KEY);
  expect(left).toEqual(['RS180-8']);
});
