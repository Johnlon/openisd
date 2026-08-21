import { test, expect } from '../fixtures.js';

// A saved driver need not carry a `name` — one saved from a record whose brand and model are
// known has those instead. Its row must still read as something and still be findable, so the
// picker derives the label with `driverShort()` (manufacturer and brand collapse when equal)
// rather than reading `.name` raw, which rendered a blank row that no search could match.

test('a saved driver with no name is listed and searchable under its derived name', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('openisd_my_drivers', JSON.stringify([{
      manufacturer: 'Dayton Audio',
      brand: 'Dayton Audio',
      model: 'Epique Series E150HE-44',
      Fs: 41, Qts: 0.35, Qes: 0.38, Qms: 4.5, Vas: 0.028, Sd: 0.0132,
      Re: 5.4, Le: 0.5e-3, Xmax: 0.0055, Pe: 70, Znom: 8, _savedAt: 1,
    }]));
  });
  await page.goto('/');

  await page.getByRole('button', { name: /Browse \/ Select/ }).click();
  await page.locator('input.filter').fill('Epique');

  // Manufacturer and brand are identical, so the label collapses to one "Dayton Audio".
  const driverRow = page.locator('.my-ditem', { hasText: 'Dayton Audio Epique Series E150HE-44' });
  await expect(driverRow).toBeVisible();

  // Choosing it embeds it in the project and closes the picker (docs/design/STATE_MODEL.md rule 1).
  await driverRow.locator('b').click();
  await page.locator('.use-btn').click();

  await expect(page.locator('.modal:not(.de-modal)')).toBeHidden();
  await expect(page.locator('.de-modal')).toBeHidden();
  expect((await page.locator('.nm').first().textContent())?.trim()).toContain('E150HE-44');
});

test('the delete button removes a saved driver that carries no name', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('openisd_my_drivers', JSON.stringify([
      { brand: 'Dayton Audio', model: 'Epique Series E150HE-44', Fs: 41, Qts: 0.35, Qes: 0.38, Qms: 4.5, Vas: 0.028, Sd: 0.0132, Re: 5.4, Le: 0.5e-3, Xmax: 0.0055, Pe: 70, Znom: 8, _savedAt: 1 },
      { brand: 'Dayton Audio', model: 'RS180-8', Fs: 37, Qts: 0.38, Qes: 0.42, Qms: 4.0, Vas: 0.030, Sd: 0.0133, Re: 5.6, Le: 0.5e-3, Xmax: 0.005, Pe: 60, Znom: 8, _savedAt: 2 },
    ]));
  });
  await page.goto('/');

  await page.getByRole('button', { name: /Browse \/ Select/ }).click();
  const row = page.locator('.my-ditem', { hasText: 'Dayton Audio Epique Series E150HE-44' });
  await expect(row).toBeVisible();

  await row.locator('.my-del').click();

  // Deletion is keyed on <brand>/<model>, so the OTHER unnamed driver survives.
  await expect(row).toBeHidden();
  const left = await page.evaluate(() => JSON.parse(localStorage.getItem('openisd_my_drivers') ?? '[]'));
  expect(left.map((d: { model: string }) => d.model)).toEqual(['RS180-8']);
});
