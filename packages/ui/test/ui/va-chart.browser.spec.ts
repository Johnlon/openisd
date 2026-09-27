import {expect, openAProject, test} from '../fixtures.js';

// WinISD's "Amplifier apparent load power (VA)" chart: P·Re·|Hf|²/|Z + Rg| (docs/CHARTS.md).

test('the Amplifier apparent load power (VA) chart reads out in VA at the cursor', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  await page.locator('.chart-select').click();
  await page.locator('.chart-select .menu-item', { hasText: 'Amplifier apparent load power (VA)' }).click();
  await expect(page.locator('.chart-select .chart-name')).toHaveText('Amplifier apparent load power (VA)');
  await page.locator('.ro-hz-input').fill('1000');
  await page.locator('.ro-hz-input').press('Enter');
  await expect(page.locator('.ro-val')).toHaveText(/^\d+\.\d{3} VA$/);
});

test('the chart drop-down is a fixed width, and the longest chart name fits in it on one line', async ({ page }) => {
  await page.goto('/');
  await openAProject(page);
  const select = page.locator('.chart-select');
  const name = page.locator('.chart-select .chart-name');
  const widths: number[] = [];
  for (const label of ['SPL', 'Transfer function magnitude (EQ/Filter)']) {
    await select.click();
    await page.locator('.chart-select .menu-item', { hasText: label }).first().click();
    widths.push((await select.boundingBox())!.width);
    expect(await name.evaluate(el => el.scrollWidth <= el.clientWidth && el.getClientRects()[0].height < 30)).toBe(true);
  }
  expect(widths[0]).toBe(widths[1]);
});
