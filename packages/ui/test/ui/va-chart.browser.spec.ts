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
